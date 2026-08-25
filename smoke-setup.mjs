/*
 * Preloaded via --import so that a DOM exists before Vite's own
 * runtime evaluates. vite.config.js sets `define: { global: "window" }`
 * for sockjs-client's benefit, which means "window" is referenced at
 * the very top of the module graph - too early for any setup inside
 * the test file itself.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost:3000/",
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Node 22 defines navigator as a getter-only global, so it has to be
// redefined rather than assigned.
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.Event = dom.window.Event;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// JSDOM implements neither of these, and the app uses both.
dom.window.matchMedia = (query) => ({
  matches: query.includes("min-width: 900px"),
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
});

globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });

globalThis.__JSDOM__ = dom;
