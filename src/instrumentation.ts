import { registerOTel } from "@vercel/otel";

// --------------------------------
// src/instrumentation.ts
//
// export function register()    L9
// --------------------------------

export function register() {
  registerOTel({ serviceName: "chatbot" });
}
