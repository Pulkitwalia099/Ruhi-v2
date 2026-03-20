import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// src/app/(auth)/api/auth/[...all]/route.ts
//

export const { GET, POST } = toNextJsHandler(auth);
