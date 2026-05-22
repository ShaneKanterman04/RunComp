import "@testing-library/jest-dom";

// Mock window.matchMedia for prefers-reduced-motion tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock requestAnimationFrame for animated counter tests
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(performance.now()), 16) as unknown as number;
};

global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

// Mock performance.now
Object.defineProperty(global, "performance", {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
  },
});
