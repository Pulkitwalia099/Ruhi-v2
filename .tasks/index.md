# Chatbot — Tasks

| Task | Title | Status | Priority | Blocked on |
|---|---|---|---|---|
| [T-0001](T-0001.md) | Migrate from NextAuth to BetterAuth | backlog | high | |
| [T-0002](T-0002.md) | Integrate Chat SDK for multi-platform bot support | backlog | medium | T-0003 |
| [T-0003](T-0003.md) | Refactor to AI SDK v6 ToolLoopAgent | backlog | medium | |

## Dependency Graph

```
T-0001 (BetterAuth)       T-0003 (ToolLoopAgent)        parallel
                              │
                              ▼
                           T-0002 (Chat SDK)
```
