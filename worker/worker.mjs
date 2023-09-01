import { parentPort } from "node:worker_threads";

parentPort.on("message", async (data) => {
  const base64 = btoa(unescape(encodeURIComponent(data)));
  const mod = await import("data:text/javascript;base64," + base64);
  parentPort.postMessage({ ...mod });
});