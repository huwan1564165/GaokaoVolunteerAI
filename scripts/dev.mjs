import { spawn } from "node:child_process";

function run(name, command, args, shell = false) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
}

const api = run("api", "node", ["server.mjs"]);
const web = run("web", "npx vite --host 127.0.0.1 --port 5173", [], true);

function shutdown() {
  api.kill();
  web.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
