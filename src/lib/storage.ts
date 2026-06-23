// Robust storage wrapper to handle blocked iframe/sandboxed localStorage SecurityError exceptions
class InMemoryStorage {
  private store: { [key: string]: string } = {};

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

const getSafeStorage = () => {
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    console.warn('localStorage is blocked or unavailable in iframe environment. Using memory-based state storage fallback.', e);
    return new InMemoryStorage();
  }
};

export const safeLocalStorage = getSafeStorage();
