import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Plotly can't initialize under jsdom (needs a real canvas/WebGL). Mock it
// globally so components that import charts still render in tests.
vi.mock("plotly.js-dist-min", () => ({
  default: {
    react: vi.fn().mockResolvedValue(undefined),
    purge: vi.fn(),
    Icons: {},
    downloadImage: vi.fn().mockResolvedValue(""),
  },
}));

afterEach(() => cleanup());

// jsdom is missing a few browser APIs used by the app.
window.URL.createObjectURL = vi.fn(() => "blob:mock");
window.URL.revokeObjectURL = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// jsdom lacks matchMedia (used by the theme provider) and ResizeObserver.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
