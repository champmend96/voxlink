import * as mediasoup from "mediasoup";
import { types as mediasoupTypes } from "mediasoup";
import { config } from "../config";
import { logger } from "./logger";

const MAX_GROUP_CALL_PARTICIPANTS = 8;

interface Participant {
  userId: string;
  displayName: string;
  sendTransport?: mediasoupTypes.WebRtcTransport;
  recvTransport?: mediasoupTypes.WebRtcTransport;
  producers: Map<string, mediasoupTypes.Producer>;
  consumers: Map<string, mediasoupTypes.Consumer>;
}

interface GroupCall {
  id: string;
  router: mediasoupTypes.Router;
  participants: Map<string, Participant>;
  createdAt: Date;
}

const mediaCodecs = [
  {
    kind: "audio" as const,
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video" as const,
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
] as unknown as mediasoupTypes.RtpCodecCapability[];

class MediasoupService {
  private workers: mediasoupTypes.Worker[] = [];
  private nextWorkerIdx = 0;
  private groupCalls = new Map<string, GroupCall>();

  async initialize(): Promise<void> {
    const numWorkers = Math.min(
      require("os").cpus().length,
      config.mediasoupWorkers
    );

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: "warn",
        rtcMinPort: config.mediasoupRtcMinPort,
        rtcMaxPort: config.mediasoupRtcMaxPort,
      });

      worker.on("died", () => {
        logger.error(`Mediasoup worker ${worker.pid} died, exiting`);
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
      logger.info(`Mediasoup worker ${worker.pid} created`);
    }
  }

  private getNextWorker(): mediasoupTypes.Worker {
    const worker = this.workers[this.nextWorkerIdx];
    this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  async createGroupCall(callId: string): Promise<GroupCall> {
    const worker = this.getNextWorker();
    const router = await worker.createRouter({ mediaCodecs });

    const groupCall: GroupCall = {
      id: callId,
      router,
      participants: new Map(),
      createdAt: new Date(),
    };

    this.groupCalls.set(callId, groupCall);
    logger.info({ callId }, "Group call created");
    return groupCall;
  }

  getGroupCall(callId: string): GroupCall | undefined {
    return this.groupCalls.get(callId);
  }

  getRouterRtpCapabilities(callId: string): mediasoupTypes.RtpCapabilities | null {
    const call = this.groupCalls.get(callId);
    return call ? call.router.rtpCapabilities : null;
  }

  canJoin(callId: string): boolean {
    const call = this.groupCalls.get(callId);
    if (!call) return false;
    return call.participants.size < MAX_GROUP_CALL_PARTICIPANTS;
  }

  async addParticipant(
    callId: string,
    userId: string,
    displayName: string
  ): Promise<Participant | null> {
    const call = this.groupCalls.get(callId);
    if (!call || call.participants.size >= MAX_GROUP_CALL_PARTICIPANTS) {
      return null;
    }

    const participant: Participant = {
      userId,
      displayName,
      producers: new Map(),
      consumers: new Map(),
    };

    call.participants.set(userId, participant);
    logger.info({ callId, userId }, "Participant joined group call");
    return participant;
  }

  async createWebRtcTransport(
    callId: string,
    userId: string,
    direction: "send" | "recv"
  ): Promise<{
    id: string;
    iceParameters: mediasoupTypes.IceParameters;
    iceCandidates: mediasoupTypes.IceCandidate[];
    dtlsParameters: mediasoupTypes.DtlsParameters;
  } | null> {
    const call = this.groupCalls.get(callId);
    if (!call) return null;

    const participant = call.participants.get(userId);
    if (!participant) return null;

    const transport = await call.router.createWebRtcTransport({
      listenIps: [
        {
          ip: config.mediasoupListenIp,
          announcedIp: config.mediasoupAnnouncedIp || undefined,
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1000000,
    });

    if (direction === "send") {
      participant.sendTransport = transport;
    } else {
      participant.recvTransport = transport;
    }

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(
    callId: string,
    userId: string,
    transportId: string,
    dtlsParameters: mediasoupTypes.DtlsParameters
  ): Promise<boolean> {
    const call = this.groupCalls.get(callId);
    if (!call) return false;

    const participant = call.participants.get(userId);
    if (!participant) return false;

    const transport =
      participant.sendTransport?.id === transportId
        ? participant.sendTransport
        : participant.recvTransport?.id === transportId
        ? participant.recvTransport
        : null;

    if (!transport) return false;

    await transport.connect({ dtlsParameters });
    return true;
  }

  async produce(
    callId: string,
    userId: string,
    kind: mediasoupTypes.MediaKind,
    rtpParameters: mediasoupTypes.RtpParameters
  ): Promise<string | null> {
    const call = this.groupCalls.get(callId);
    if (!call) return null;

    const participant = call.participants.get(userId);
    if (!participant?.sendTransport) return null;

    const producer = await participant.sendTransport.produce({
      kind,
      rtpParameters,
    });

    participant.producers.set(producer.id, producer);

    producer.on("transportclose", () => {
      participant.producers.delete(producer.id);
    });

    return producer.id;
  }

  async consume(
    callId: string,
    consumerUserId: string,
    producerUserId: string,
    producerId: string,
    rtpCapabilities: mediasoupTypes.RtpCapabilities
  ): Promise<{
    id: string;
    producerId: string;
    kind: mediasoupTypes.MediaKind;
    rtpParameters: mediasoupTypes.RtpParameters;
  } | null> {
    const call = this.groupCalls.get(callId);
    if (!call) return null;

    const consumer = call.participants.get(consumerUserId);
    if (!consumer?.recvTransport) return null;

    if (!call.router.canConsume({ producerId, rtpCapabilities })) {
      return null;
    }

    const newConsumer = await consumer.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    consumer.consumers.set(newConsumer.id, newConsumer);

    newConsumer.on("transportclose", () => {
      consumer.consumers.delete(newConsumer.id);
    });

    newConsumer.on("producerclose", () => {
      consumer.consumers.delete(newConsumer.id);
    });

    return {
      id: newConsumer.id,
      producerId,
      kind: newConsumer.kind,
      rtpParameters: newConsumer.rtpParameters,
    };
  }

  async removeParticipant(callId: string, userId: string): Promise<void> {
    const call = this.groupCalls.get(callId);
    if (!call) return;

    const participant = call.participants.get(userId);
    if (!participant) return;

    for (const producer of participant.producers.values()) {
      producer.close();
    }
    for (const consumer of participant.consumers.values()) {
      consumer.close();
    }
    participant.sendTransport?.close();
    participant.recvTransport?.close();

    call.participants.delete(userId);
    logger.info({ callId, userId }, "Participant left group call");

    if (call.participants.size === 0) {
      this.closeGroupCall(callId);
    }
  }

  closeGroupCall(callId: string): void {
    const call = this.groupCalls.get(callId);
    if (!call) return;

    for (const participant of call.participants.values()) {
      for (const producer of participant.producers.values()) {
        producer.close();
      }
      for (const consumer of participant.consumers.values()) {
        consumer.close();
      }
      participant.sendTransport?.close();
      participant.recvTransport?.close();
    }

    call.router.close();
    this.groupCalls.delete(callId);
    logger.info({ callId }, "Group call closed");
  }

  getParticipants(callId: string): Array<{ userId: string; displayName: string }> {
    const call = this.groupCalls.get(callId);
    if (!call) return [];

    return Array.from(call.participants.values()).map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
    }));
  }

  getProducers(callId: string, excludeUserId?: string): Array<{
    userId: string;
    producerId: string;
    kind: mediasoupTypes.MediaKind;
  }> {
    const call = this.groupCalls.get(callId);
    if (!call) return [];

    const producers: Array<{
      userId: string;
      producerId: string;
      kind: mediasoupTypes.MediaKind;
    }> = [];

    for (const [userId, participant] of call.participants) {
      if (excludeUserId && userId === excludeUserId) continue;
      for (const [producerId, producer] of participant.producers) {
        producers.push({ userId, producerId, kind: producer.kind });
      }
    }

    return producers;
  }

  getActiveCallCount(): number {
    return this.groupCalls.size;
  }
}

export const mediasoupService = new MediasoupService();
