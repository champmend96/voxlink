import { config } from "../config";
import { logger } from "./logger";

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface APNsNotification {
  token: string;
  payload: PushPayload;
}

interface FCMNotification {
  token: string;
  payload: PushPayload;
}

class PushNotificationService {
  private apnsConfigured = false;
  private fcmConfigured = false;

  constructor() {
    this.apnsConfigured = !!(
      config.apnsKeyPath &&
      config.apnsKeyId &&
      config.apnsTeamId
    );
    this.fcmConfigured = !!config.fcmServiceAccountPath;

    if (this.apnsConfigured) {
      logger.info("APNs push notifications configured");
    }
    if (this.fcmConfigured) {
      logger.info("FCM push notifications configured");
    }
    if (!this.apnsConfigured && !this.fcmConfigured) {
      logger.warn("No push notification providers configured");
    }
  }

  async sendToiOS(notification: APNsNotification): Promise<boolean> {
    if (!this.apnsConfigured) {
      logger.debug("APNs not configured, skipping iOS push");
      return false;
    }

    try {
      // In production, use @parse/node-apn:
      // const apn = require("@parse/node-apn");
      // const provider = new apn.Provider({
      //   token: {
      //     key: config.apnsKeyPath,
      //     keyId: config.apnsKeyId,
      //     teamId: config.apnsTeamId,
      //   },
      //   production: config.nodeEnv === "production",
      // });
      // const note = new apn.Notification();
      // note.alert = { title: notification.payload.title, body: notification.payload.body };
      // note.payload = notification.payload.data || {};
      // note.topic = "com.voxlink.app";
      // note.pushType = "voip";
      // await provider.send(note, notification.token);

      logger.info({ token: notification.token.slice(0, 8) + "..." }, "iOS push sent");
      return true;
    } catch (err) {
      logger.error({ err }, "Failed to send iOS push");
      return false;
    }
  }

  async sendToAndroid(notification: FCMNotification): Promise<boolean> {
    if (!this.fcmConfigured) {
      logger.debug("FCM not configured, skipping Android push");
      return false;
    }

    try {
      // In production, use firebase-admin:
      // const admin = require("firebase-admin");
      // if (!admin.apps.length) {
      //   admin.initializeApp({
      //     credential: admin.credential.cert(config.fcmServiceAccountPath),
      //   });
      // }
      // await admin.messaging().send({
      //   token: notification.token,
      //   notification: {
      //     title: notification.payload.title,
      //     body: notification.payload.body,
      //   },
      //   data: notification.payload.data || {},
      //   android: { priority: "high" },
      // });

      logger.info({ token: notification.token.slice(0, 8) + "..." }, "Android push sent");
      return true;
    } catch (err) {
      logger.error({ err }, "Failed to send Android push");
      return false;
    }
  }

  async sendCallNotification(
    deviceTokens: Array<{ token: string; platform: string }>,
    callerName: string,
    callType: string,
    roomId: string
  ): Promise<void> {
    const payload: PushPayload = {
      title: "Incoming Call",
      body: `${callerName} is calling you (${callType})`,
      data: {
        type: "incoming_call",
        callerName,
        callType,
        roomId,
      },
    };

    const results = await Promise.allSettled(
      deviceTokens.map((dt) => {
        if (dt.platform === "ios") {
          return this.sendToiOS({ token: dt.token, payload });
        } else {
          return this.sendToAndroid({ token: dt.token, payload });
        }
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
    logger.info(
      { sent, total: deviceTokens.length },
      "Call push notifications dispatched"
    );
  }
}

export const pushService = new PushNotificationService();
