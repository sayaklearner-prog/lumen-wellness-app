import { EventEmitter } from "events";
import { contextEngine } from "./context";
import { logger } from "../lib/logger";

export type EventCallback = (payload: any, metadata: Record<string, any>) => void | Promise<void>;

class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  subscribe(eventName: string, callback: EventCallback) {
    this.emitter.on(eventName, async (payload, metadata) => {
      try {
        await callback(payload, metadata);
      } catch (error) {
        logger.error({ error, eventName, metadata }, "Event handler failed");
      }
    });
  }

  publish(eventName: string, payload: any) {
    const requestId = contextEngine.getRequestId();
    const metadata = { requestId, timestamp: new Date().toISOString() };
    logger.debug({ eventName, payload, metadata }, "Publishing event");
    
    // Process asynchronously to avoid blocking the main thread
    setImmediate(() => {
      this.emitter.emit(eventName, payload, metadata);
    });
  }
}

export const eventBus = new EventBus();
