export class DIContainer {
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();

  registerInstance<T>(key: string, instance: T) {
    this.services.set(key, instance);
  }

  registerFactory<T>(key: string, factory: () => T) {
    this.factories.set(key, factory);
  }

  resolve<T>(key: string): T {
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }
    if (this.factories.has(key)) {
      const factory = this.factories.get(key)!;
      const instance = factory();
      this.services.set(key, instance); // singleton by default
      return instance as T;
    }
    throw new Error(`Service not found: ${key}`);
  }
}

export const di = new DIContainer();
