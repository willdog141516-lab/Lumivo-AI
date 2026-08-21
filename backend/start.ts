import { pathToFileURL } from "node:url";

import { createAiClient } from "./ai-client.js";
import { loadRuntimeConfig } from "./config.js";
import { createBackendServer } from "./server.js";
import { createFixtureTripPlanner } from "./trip-planner.js";

export function startServer() {
  const config = loadRuntimeConfig();
  const client = createAiClient(config);
  const server = createBackendServer({
    config,
    client,
    planner: createFixtureTripPlanner(client),
  });
  server.listen(config.port, () => {
    console.log(`AI backend listening on port ${config.port}`);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
