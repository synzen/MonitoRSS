# ADR-004 — Destination extensibility: keep the FeedConnectionType shell honest, don't build the abstraction

**Status:** Accepted
**Date:** 2026-05-28
**Scope:** `services/backend-api/client/src/`.

## Context

The app delivers feed articles to Discord today. Other destinations (Slack, generic webhook, email, etc.) are aspirational — the maintainer confirmed they're "eventually, but not driving anything now."

The code looks like an abstraction _was_ planned and _partially_ started:

- `types/FeedConnection.ts:5-7` defines `enum FeedConnectionType { DiscordChannel = "DISCORD_CHANNEL" }`. The enum exists but has exactly one value.
- `constants/pages.ts:5-12` defines `getConnectionPathByType(type)` with a switch — but only the `DiscordChannel` case is implemented.
- `types/FeedConnection.ts` `FeedConnectionSchema.details` uses Yup's `.when("key", …)` to switch validation by `FeedConnectionType` — but only the Discord branch exists and the default throws.

And then the abstraction was never realized:

- `features/feedConnections/components/AddConnectionDialog/index.tsx` (23 lines) renders `<DiscordTextChannelConnectionDialogContent />` unconditionally. No connection-type switch.
- `DiscordTextChannelConnectionDialogContent.tsx` (908 lines) is the only implementation.
- `pages/ConnectionDiscordChannelSettings.tsx` is the only settings page. No generic `ConnectionSettings` shell exists.
- 8 API files in `features/feedConnections/api/` are named `*DiscordChannelConnection.ts`. The hooks (`useCreateDiscordChannelConnection`, etc.) are similarly destination-named.
- 27+ component files inside `feedConnections/` are prefixed `Discord*`.

The "abstraction shell" exists at the route/enum/schema level. The implementation is 100% Discord-coded.

The standing tension: every time someone touches connection code, they could either _harden the Discord-only assumption_ (e.g., remove the unused enum / switch as "dead code") or _uphold the shell_ (keep the switches in place even though there's one case). Without a stated decision, the codebase oscillates.

## Decision

### Position: keep the shell honest, do NOT build the abstraction

We will:

1. **Preserve and lightly maintain the existing abstraction shell.** The `FeedConnectionType` enum, the `getConnectionPathByType` switch, the schema's `.when("key", …)` validation — these stay, even though they have one case. They are seams. We do not collapse them to "just Discord."

2. **Make the AddConnectionDialog honest about being a switch.** It originally rendered the Discord content unconditionally; it now dispatches on `connectionType`:

   ```tsx
   // features/feedConnections/AddConnectionDialog/index.tsx
   export const AddConnectionDialog = ({ connectionType, ...props }) => {
     switch (connectionType) {
       case FeedConnectionType.DiscordChannel:
         return <DiscordTextChannelConnectionDialogContent {...props} />;
       default:
         assertNever(connectionType);
     }
   };
   ```

   The dispatcher shell is destination-agnostic and lives at `features/feedConnections/AddConnectionDialog/`; the Discord content lives inside the `discordChannel/` sub-feature.

3. **Forbid hardening the Discord-only assumption in new code.** Specifically, the rules below.

We will NOT:

- Build a generic `<ConnectionDialog destinationConfig={…} />` that abstracts over destinations.
- Refactor `DiscordTextChannelConnectionDialogContent` into a "Discord adapter" of a generic shape.
- Create a `destinations/` registry or a plugin pattern.
- Rename Discord-specific files to neutral names speculatively.
- Add a second `FeedConnectionType` value before there's a real second destination to validate the abstraction against.

These cost real time now for a benefit that's "eventually, not driving anything." When destination #2 is committed (any work begins), the abstraction can be designed against _two_ concrete cases, not one and a guess.

### Structural anticipation is permitted; runtime abstraction is deferred

The boundary between "keep the shell honest" and "don't build the abstraction" is the line between **structural anticipation** and **runtime abstraction**:

- **Structural anticipation** — a destination-named folder seam (`discordChannel/`, a future `slackChannel/`) — is **permitted now**. A folder named for a destination is a _factual grouping_ ("is this Discord-specific code?"), not a predicted abstraction. You cannot get the boundary wrong, and the carried cost is one path segment, fully reversible.
- **Runtime abstraction** — generic adapters, a plugin / destination registry, `destinationConfig`-style props, a `<ConnectionDialog destinationConfig={…} />` — is **deferred until destination #2 is committed**. Built from a single concrete case (Discord), it carries the real speculative-generality harm: you'd guess the interface shape from one example and likely mis-fit destination #2, plus pay indirection everywhere.

So the folder seam is cheap and safe to keep now; the runtime abstraction is expensive and risky and waits. The "We will NOT" list above is exactly the runtime-abstraction set; the destination-named folders blessed by **ADR-002** are the permitted structural anticipation, _not_ the abstraction this ADR defers. This is why the two ADRs agree rather than conflict: ADR-002 keeps the folder seam, ADR-004 defers the runtime abstraction.

### Recommended folder structure

Destination-specific code lives in a destination-named sub-feature under `features/feedConnections/`. This is the "honest shell" — the destination boundary is visible at the folder level even though only one destination exists today.

```
features/feedConnections/
├── AddConnectionDialog/               — generic shell; switches on FeedConnectionType
├── discordChannel/                    — sub-feature: everything Discord-channel-specific
│   ├── connection/                    — capability: create / configure / manage a connection
│   │   ├── api/                       (createDiscordChannelConnection.ts, …)
│   │   ├── components/                (the Discord dialog body, DiscordMessageForm, ConnectionSettings, …)
│   │   ├── hooks/                     (useDiscordChannelConnection, …)
│   │   └── types/  utils/  constants/
│   ├── messageBuilder/                — capability: the editor
│   ├── templates/                     — capability: Discord-specific message templates
│   ├── shared/                        — Discord render kernel shared across the capabilities
│   │   └── components/ contexts/ utils/   (DiscordMessageDisplay, MentionDataContext, …)
│   └── index.ts
├── slackChannel/                      — future: where Slack would land, mirroring this shape
└── index.ts
```

The top level of `feedConnections/` carries only the generic shell and the destination folders — no destination-specific technical folders. Inside a destination, partitioning is by capability (`connection/`, `messageBuilder/`, `templates/`, `shared/`), with technical folders only at the capability leaf. That single-axis-per-level rule, and the `shared/` kernel, are specified in ADR-002.

Why this shape:

- **The destination boundary is visible at the folder level.** A contributor looking for "Slack code" knows exactly where it goes (`slackChannel/`), without an abstraction layer existing in source.
- **`AddConnectionDialog` becomes a real switch.** The top-level `feedConnections/AddConnectionDialog/` is the destination-agnostic shell; it dispatches to `discordChannel/connection/components/AddConnectionDialog/` based on `connectionType`. When Slack ships, the shell dispatches to `slackChannel/connection/components/AddConnectionDialog/` too — the seam is at the dispatcher, not at a runtime registry.
- **Co-locates the three big Discord files** (`DiscordTextChannelConnectionDialogContent.tsx`, `MessageBuilder.tsx`, `ComponentPropertiesPanel.tsx`) under one roof — they're the same conceptual thing.
- **Templates are correctly scoped.** Today's `features/templates/` becomes `features/feedConnections/discordChannel/templates/` because the templates are Discord-specific message configurations (verified by grep — all 8 import sites are inside the Discord connection editor flow).

### Rules for new code

**Forbidden:**

- Removing `FeedConnectionType` or the switch in `getConnectionPathByType` because they "only have one case." They are explicit seams; deleting them costs the same as adding them later.
- Adding code that branches `if (isDiscord)` or `if (connection.type === 'DISCORD_CHANNEL')` — branch on `FeedConnectionType` even when there's one case (compiler-enforced `assertNever` default).
- Adding new Discord-specific files to top-level `types/`, `utils/`, `components/`, `constants/`. Discord-specific code lives in `features/feedConnections/discordChannel/` (or `types/discord/` for pure type definitions).
- Adding Discord-specific files directly inside `features/feedConnections/` outside the `discordChannel/` sub-feature. The top level of `feedConnections/` is for destination-agnostic code only.
- Adding Discord types to non-Discord file names. If a file is named `FeedConnection.ts` it can carry the generic `FeedConnectionSchema`; the Discord-specific `DiscordChannelConnectionDetailsSchema` should live in a Discord-named sibling (`DiscordChannelConnection.ts`) and be imported into `FeedConnection.ts` for the `.when` case.

**Allowed (today):**

- Writing new Discord-specific code inside `features/feedConnections/discordChannel/`. The sub-feature is the canonical home.
- Keeping the Discord-named hooks and API files. Renaming them to "neutral" names without a second destination doesn't help — the second destination would just need new files anyway.

### What changes when destination #2 is committed

Out of scope for this ADR. When the maintainer commits to (say) Slack, a new ADR-007 will document the destination abstraction designed against two real cases. Today's decision is to **defer** that work, not to predefine it.

The minimum that will need to change at that point — captured here only for planning, not to be done now:

- Add `FeedConnectionType.SlackChannel` (or similar). Compiler will surface every switch site for backfill.
- Add `SlackChannelConnectionDetailsSchema` to the `.when` validator.
- Add a `SlackChannelConnectionDialogContent` and wire AddConnectionDialog to switch.
- Add a `pages/ConnectionSlackChannelSettings.tsx` (or, if the destinations diverge enough, generalize the settings page to take a destination prop).
- Add Slack-specific API files, hooks, and message editor under `features/feedConnections/slackChannel/`, mirroring the `discordChannel/` shape.
- Settle on whether to rename the existing Discord-specific files. Probably yes at that point, since two destinations make a generic name informative.

Estimated total: 2-3 days of focused work, _if_ the shell stays honest until then. That's the value of this ADR.

## Consequences

**Easier:**

- Today's contributors (human and LLM) have a clear "stay in your lane" rule for connection code. Don't generalize; don't harden.
- The abstraction shell isn't accidentally deleted in a cleanup PR.
- When destination #2 lands, the shell is mostly already in place — the AddConnectionDialog switch is the main thing.
- New top-level `types/utils/components/` files won't gain Discord-specific names.

**Harder:**

- "It would be slightly cleaner to collapse this if-only-Discord switch" PRs get rejected. Style tax.
- The codebase keeps a _visible_ unused-branch shape (the switch with one case, the `.when` with one branch) that some contributors will read as dead code. Comment them with a brief "intentional — destination shell" note.

**Lost:**

- The opportunity to design the destination abstraction now while context is fresh. We accept this loss because:
  - The current Discord-only shape works.
  - Designing an abstraction with one example is a known anti-pattern (the abstraction always fits the one case and misfits the second).
  - The maintainer has stated this is not driving timelines.

**Specifically for code placement:**

- Discord-coupled helpers such as `getPrettyConnectionName.ts` belong inside `features/feedConnections/discordChannel/`, not at the top level — ADR-002 governs this. (`customPlaceholderStepType.ts` and the `CustomPlaceholder` type are exceptions: they're generic text-transformation primitives, not Discord-specific, so they stay in the shared base.)
- `types/discord/` is the home for pure Discord type definitions (`DiscordFormatOptions.ts`, `DiscordViewComponent.ts`, `DiscordViewEmbed.ts` live there).
- `LegacyDiscordMessageForm/` is unrelated to this ADR — it's a _Discord message format_ legacy concern, not a destination concern. It remains a candidate to finish-or-remove independently.

## Alternatives considered

- **Build the destination abstraction now.** Rejected because (a) maintainer says it's not driving timelines, (b) abstractions built with one concrete case are usually wrong, (c) the cost is non-trivial (estimated ~2 weeks), and (d) the shell already exists at the type level.
- **Collapse the shell — accept Discord-only.** Rejected because keeping the shell is free (no code is being maintained) and re-introducing it later costs the same as adding the second case will anyway. The deletion would be churn.
- **Rename Discord-specific files to neutral names now.** Rejected for the same reason as #2 — speculative renaming with no second case usually picks the wrong name. Defer until destination #2 forces the choice.
- **Add a placeholder second enum value (`FeedConnectionType.Webhook = "PLACEHOLDER"`) to prove the switch is real.** Rejected — placeholder values are worse than no second value (they tempt premature implementation).
