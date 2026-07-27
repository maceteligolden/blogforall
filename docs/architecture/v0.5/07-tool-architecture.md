# 07 — Tool Architecture

## 1. Principles

1. **Single responsibility** — one tool = one action.
2. **No large utility classes** — prefer small `@injectable()` tool classes.
3. **Skills call tools; orchestrator rarely does** (except migration fallback / confirmations).
4. **Deterministic** — tools should not “reason”; they execute.
5. **Stable names** — `domain.action` (e.g. `blogs.publish`).
6. **Idempotent where possible** — document side effects in tool description.
7. **Writing never gets search tools** — Research owns discovery.
8. **No Conversation Intelligence tools that execute workflows** — CI has no tool surface for Research/Writing.

---

## 2. Tool contract (existing, keep)

```typescript
interface OrchestratorTool {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;
}
```

Registry: `OrchestratorToolRegistry` — singleton map; re-registration throws at boot.

---

## 3. Feature module layout (target)

```
ai/tools/
  content/          # blogs.*, categories.*
  research/         # search.web, fetch.page, future serp.*
  seo/              # future: keyword.expand, serp.features
  analytics/        # blogs.statistics, future gsc.*
  publishing/       # publish, schedule, unpublish, cancel
  images/           # future upload/generate
  storage/          # future assets
  communication/    # future notify/email
  workspace/        # workspace.* (legacy memory tools)
  memory/           # memory.remember (target) — thin adapter to Memory Manager
  campaign/         # campaigns.*
  strategy/         # strategy.proposeCalendar (calendar — not Content Strategy skill)
  scheduled/        # scheduled.* review queue
```

---

## 4. Research tools (expanded)

| Tool | Phase use | Notes |
|------|-----------|-------|
| `search.web` | Research 4, 6, 11 | Tavily MVP; query from plan/gaps |
| `fetch.page` (future/MVP optional) | Research 6 | Selective fetch for top quality_score sources |
| future `serp.features` | Research 4, 11 | SERP structure for competitor analysis |

Research skill allowlist: **only** research + read-only memory helpers via Memory Manager.  
Writing skill allowlist: **excludes** `search.web` and `fetch.page`.

---

## 5. Inventory (current → feature bucket)

### content/

| Tool | Notes |
|------|-------|
| `blogs.list` / `get` / `statistics` | |
| `blogs.createDraft` / `update` / `duplicate` | |
| `blogs.generateDraft` | **Legacy supervisor path**; new paths use Research skill + Writing skill |
| `blogs.review` | Legacy; prefer Content Optimization skill |
| `categories.*` | |

### publishing/

`blogs.publish` / `unpublish` / `schedule` / `reschedule` / `cancelSchedule` / `delete` — destructive ops need confirmation.

### workspace/ / memory/

| Tool | Notes |
|------|-------|
| `workspace.getMemory` / `updateMemory` | **Legacy** — new graph uses Memory Manager retrieve/remember |
| `memory.remember` (target) | Enqueue/sync candidate; no raw Mongo belief patch from orchestrator |
| `workspace.renameWorkspace` | |
| `workspace.completeOnboarding` | May sync-remember required fields via MM |

### campaign/ / strategy/ / scheduled/

Unchanged from prior inventory.
---

## 6. ToolInvoker allowlists (MVP)

| Skill | Allowed tools |
|-------|-----------------|
| Conversation | none (MemoryManager.retrieve only) |
| ContentStrategy | optional `strategy.proposeCalendar`; memory via MM |
| Research | `search.web`, optional `fetch.page` |
| Writing | blog generation services; `blogs.update` / `createDraft` — **no search** |
| Content Optimization | `blogs.get`, content library search; **no** open-web search |
| Publishing | publish/schedule family + `blogs.get` |
| Analytics | `blogs.statistics`, `blogs.list`, campaign health |

Enforcement is hard in `ToolInvoker` (throw / `SkillResult.error` if violated).

---

## 7. Future MCP integrations

```
ToolAdapter → local service | MCP client
```

Same `domain.action` names; Research phases unchanged.

---

## 8. Anti-patterns

| Anti-pattern | Prefer |
|--------------|--------|
| Writing skill calling `search.web` | Orchestrator schedules Research first |
| Separate SEO + GAO orchestrator skills | Single `content_optimization` skill |
| `blogs.generateDraft` as the strategist path | Strategy → Research Package → Writing |
| Tool that plans multi-step workflows | Skill + orchestrator plan |
| Silent destructive execute | Confirmation contract |
| Orchestrator patching WorkspaceMemory Mongo | Memory Manager evaluation pipeline |
| Loading all memories into a turn | RetrievalEngine profiles |
| CI / NLU tool that starts Research/Writing | Conversation Intelligence → plan → skills |

---

## Next

- Memory: [08-memory-architecture.md](./08-memory-architecture.md)
- Research pipeline: [16-research-pipeline.md](./16-research-pipeline.md)
