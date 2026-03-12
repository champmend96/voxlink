const listeners = new Map<string, Function[]>();

const mockSocket = {
  connected: true,
  id: "mock-socket-id",
  on: jest.fn((event: string, handler: Function) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event)!.push(handler);
  }),
  off: jest.fn((event: string, handler: Function) => {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      const idx = eventListeners.indexOf(handler);
      if (idx !== -1) eventListeners.splice(idx, 1);
    }
  }),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connect: jest.fn(),
  // Helper to simulate events in tests
  __simulateEvent: (event: string, data: any) => {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((handler) => handler(data));
    }
  },
};

export const io = jest.fn().mockReturnValue(mockSocket);
export default { io };
