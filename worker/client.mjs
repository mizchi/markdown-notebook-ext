import { Worker } from "node:worker_threads";
const workerUrl = new URL("./worker.mjs", import.meta.url).pathname;

function run(code) {
  const worker = new Worker(workerUrl);
  return new Promise((resolve, reject) => {
    worker.postMessage(code);
    worker.once("message", (module) => {
      worker.terminate();
      resolve(module);
    });
    worker.once("error", (err) => {
      worker.terminate();
      reject(err);
    });
  });
}

const code = `
export const x = 3;
`;

run(code).then((module) => {
  console.log(module);
});

