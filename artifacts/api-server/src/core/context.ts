import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

export interface RequestContext {
  requestId: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  metadata: Record<string, any>;
}

class ContextEngine {
  private als = new AsyncLocalStorage<RequestContext>();

  run<R>(context: Partial<RequestContext>, callback: () => R): R {
    const store: RequestContext = {
      requestId: context.requestId ?? randomUUID(),
      userId: context.userId,
      userAgent: context.userAgent,
      ip: context.ip,
      metadata: context.metadata ?? {},
    };
    return this.als.run(store, callback);
  }

  getStore(): RequestContext | undefined {
    return this.als.getStore();
  }

  getRequestId(): string {
    return this.getStore()?.requestId ?? "system";
  }
}

export const contextEngine = new ContextEngine();
