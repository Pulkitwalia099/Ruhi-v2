---
"chatbot": minor
---

Refactor chat route to use AI SDK ToolLoopAgent. Replaces raw `streamText()` with `createChatAgent()` factory wrapping `ToolLoopAgent` — encapsulates model + tools + instructions + loop control (`stepCountIs(5)`) into a reusable agent abstraction. Upgrades AI SDK packages (`ai` 6.0.133, `@ai-sdk/react` 3.0.135, `@ai-sdk/openai` 3.0.47, `@ai-sdk/anthropic` 3.0.63, `@ai-sdk/google` 3.0.52). No user-facing behavior change.
