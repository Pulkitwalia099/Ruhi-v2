// 1. Load .env.local BEFORE any app modules parse
require("dotenv").config({ path: ".env.local" });

// 2. Replace "server-only" with a no-op so scripts can import server code
const Module = require("module");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") return __filename;
  return originalResolve.call(this, request, parent, isMain, options);
};
