import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// ------------------------------
// src/lib/auth-client.ts
//
// export const authClient    L10
// ------------------------------

export const authClient = createAuthClient({
  plugins: [anonymousClient()],
});
