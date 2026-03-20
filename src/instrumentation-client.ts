import { initBotId } from "botid/client/core";

// src/instrumentation-client.ts
//

initBotId({
  protect: [
    {
      path: "/api/chat",
      method: "POST",
    },
  ],
});
