import "@testing-library/jest-dom/vitest";

// MUI's useMediaQuery calls window.matchMedia, which jsdom doesn't implement.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver;
}

// This Node version's experimental global localStorage shadows jsdom's own
// implementation without actually backing it, leaving window.localStorage
// present but non-functional. Replace it with a minimal in-memory Storage.
if (!window.localStorage || typeof window.localStorage.clear !== "function") {
  class LocalStorageMock implements Storage {
    private store = new Map<string, string>();

    get length() {
      return this.store.size;
    }

    clear() {
      this.store.clear();
    }

    getItem(key: string) {
      return this.store.has(key) ? this.store.get(key)! : null;
    }

    key(index: number) {
      return Array.from(this.store.keys())[index] ?? null;
    }

    removeItem(key: string) {
      this.store.delete(key);
    }

    setItem(key: string, value: string) {
      this.store.set(key, String(value));
    }
  }

  Object.defineProperty(window, "localStorage", {
    value: new LocalStorageMock(),
    writable: true,
  });
}
