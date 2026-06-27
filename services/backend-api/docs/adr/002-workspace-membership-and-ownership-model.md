# ADR-002 — Workspace membership & ownership model: provider-agnostic `workspaces` + `workspace_memberships`, native over better-auth

**Status:** Accepted
**Date:** 2026-05-29 (feed↔workspace association and slugs added 2026-05-31)
**Scope:** `services/backend-api/src/` (data model, routes, auth gate). The frontend consumes this contract; its UI decisions live in client ADR-008.

## Context

Client ADR-005 ("Workspace scoping") put the forward-compatibility seams in place — the `/workspaces/:workspaceSlug` route shape, an optional `workspaceId` on `getUserFeeds()`, and a nullable `workspaceId` on `UserFeedSchema` — and deferred the membership/ownership model to "a backend ADR." This is that ADR.

Functional requirements:

1. A user can belong to multiple workspaces; a workspace has multiple users.
2. Member management (invite/add/remove) is **out of scope** this round.
3. Creating a workspace requires a **verified email** and a workspace **name**. "Verified" means an email the user owns and *we* verified — not the email Discord hands us, which is a mutable OAuth claim that only proves Discord's belief, not mailbox control (§4).
4. Two roles — **owner** and **admin**. Owner-only actions (delete, transfer ownership) are gated; access is otherwise identical and every member can edit (§3).
5. Workspaces should be able to own user feeds (built this round — §7).
6. **Self-host, MIT-licensing, no forced pay at small scale** are hard constraints (§8).

Ground truth from discovery:

- **Identity is Discord-coupled today.** `requireAuthHook` sets `request.discordUserId`; feed ownership keys on `user.discordUserId`. The `User` doc has a Mongo `_id` (exposed as `IUser.id`) plus `discordUserId`, `email`, `featureFlags`.
- **No email verification exists** — `email` is a bare Discord-OAuth string with no verified flag or flow. A genuine gap for req #3.
- **A per-user feature-flag mechanism already exists** (`User.featureFlags` → `GET /users/@me`; `externalProperties` is the precedent).
- **Persistence (backend ADR-001):** raw Mongoose repository classes, no new interface files, vertical slices under `src/features/<name>/`.

Two maintainer constraints override the "follow the nearest precedent" default:

- **Nothing Discord-related may couple to the workspace data model.** (Rules out mirroring the feed-sharing `invites[]` precedent, which keys on `discordUserId`.)
- **Evaluate an open-source library (better-auth) before building natively.**

A note on the name: "workspace" is the *outer* billing + membership + resource unit, matching better-auth's `organization` plugin (§5, the documented escalation path) and every reference platform that exposes an "organization"/"workspace". "Team" is intentionally left free for a future *inner* grouping (a workspace containing teams) if one is ever needed.

## Decision

### 1. Workspace↔user edges reference the internal user ID, never `discordUserId`

Membership references `IUser.id` (the `User` document's Mongo `_id`). The workspace domain has **zero** references to `discordUserId`, Discord guilds, or any Discord concept. This is the load-bearing decision: it aligns with the destination-extensibility roadmap (client ADR-004), survives a future migration off Discord-as-sole-identity, and makes the workspace model a clean shape to map onto better-auth later (§5). Feed *ownership* stays on `discordUserId` for now (legacy, untouched); the workspace↔user edge is provider-agnostic from day one.

### 2. Two collections: `workspaces` and `workspace_memberships` (not an embedded array)

`workspaces` holds `{ name, createdByUserId (audit only), timestamps }`; `workspace_memberships` holds `{ workspaceId, userId (refs `users._id`, NOT `discordUserId`), role, timestamps }` with a unique index on `{ userId, workspaceId }`. That one index enforces one-membership-per-(workspace,user) and its `userId` prefix serves the hot "workspaces I'm in" lookup, so no separate index is needed. Nothing queries by `workspaceId` alone yet (the "members of a workspace" listing ships with member management, §10).

A separate collection rather than an embedded `members[]` because: the `invites[]` precedent keys on `discordUserId` (violates the decoupling constraint, so it doesn't apply); "workspaces I'm in" is the hottest query and is a clean indexed lookup here vs. a scan against `workspaces`; it maps 1:1 onto better-auth's `member` table (§5); and it avoids unbounded array growth.

One `WorkspaceMongooseRepository` owns both collections (ADR-001: no interface file). Slice at `src/features/workspaces/`.

**At least one owner always exists.** The membership collection makes orphan-prevention a property of the data, not a cleanup job: `WorkspaceMongooseRepository.countOwners` is the check that leave/remove/demote operations (member management, §10) run before mutating, rejecting with `CANNOT_REMOVE_LAST_OWNER` if the action would drop the last owner. The bad state is forbidden at the operation boundary rather than swept up after the fact; no soft-`inactive` flag is added.

### 3. Role is an open-ended string validated by a Zod enum

`role` is stored as a string, validated by `WorkspaceRole = z.enum(['owner','admin'])`. Adding a role later is "extend the enum + add the check" — no migration. The creator gets a single `owner` membership. Every member can manage the workspace and its feeds; the only role gate is **owner-only** actions — `deleteWorkspace` and `transferOwnership` — so there is no read-only tier. Authorization is a `can(action, role)` function in `workspaces.service.ts` (today: owner-only actions ⇒ `owner`, else any member) — handlers call `can()`, never compare role strings inline. This is the seam any future permission model extends; the `WORKSPACE_INSUFFICIENT_ROLE` error surfaces a failed check.

### 4. Verified email: an owned email we verify ourselves (passwordless), never Discord's claim

Add to the `User` schema `verifiedEmail` + `verifiedEmailVerifiedAt` (both optional). These are **separate** from the Discord-sourced `email` (which stays untrusted for this purpose) and are never the primary key — the identifier is `User._id` (§1). `verifiedEmail` is **unique across users** so it can later become a login anchor (§9).

**Flow (passwordless):** the user enters an email they own (pre-filled with the Discord email for convenience, but confirmation is always required) → we email a one-time code → on confirm we set the two fields. `POST /workspaces` returns `403` unless `verifiedEmail` is set.

**Why passwordless:** with a strong federated login already in place, a separate password is the worst option on both axes — it adds hash custody, reset flows, and credential-stuffing surface (security) and forces a second secret (usability), for no gain. Proving mailbox ownership once is sufficient.

Key sub-decisions:

- **A typed code (OTP), not a magic link.** The user is already authenticated mid-flow, so a short code works cross-device, dodges the email/AV-scanner link-prefetch bug (scanners GET links and silently consume single-use tokens), and is easy to rate-limit. Magic link is a near-equivalent alternative; code is chosen. The code's small space is *not* the security boundary — an attempt cap + short expiry + send rate-limit are; the code is hashed at rest as defense-in-depth.
- **Endpoints live in the `users` slice, not `workspaces`** (verified email is a reusable user attribute): a send and a confirm endpoint under `/users/@me/...`. The workspaces handler only reads `User.verifiedEmail`.
- **Mail transport** goes through generic SMTP (nodemailer, MIT) behind a small swappable mailer — never a proprietary email API (req #6). SMTP is optional: these endpoints are gated per-user by the workspaces feature flag (§8), and when SMTP is unconfigured a send returns `EMAIL_VERIFICATION_UNAVAILABLE`.

(Storage shape, code length/expiry/attempt constants, and normalization rules live in the implementing code, not here — they are tuning, not architecture.)

### 5. Build natively now; better-auth's organization plugin is the documented escalation path

better-auth ships an `organization` plugin (orgs/members/roles/invitations/RBAC) with a MongoDB adapter that maps almost 1:1 onto this feature and brings email verification for free. We evaluated adopting it now and **defer it** for this round.

The real coupling is a single foreign key: **`member.userId` references better-auth's own `user` table** — the org plugin is bolted to better-auth core, not standalone. So every workspace member must exist in a better-auth-visible `user` table, forcing either (a) pointing better-auth's adapter at our `User` collection and ceding ownership of it (plus running better-auth's `session`/`account`/`verification` collections we don't use), or (b) running a separate better-auth `user` table and syncing into it. Either way we'd run better-auth's runtime + ~6 mostly-unused tables to use ~10% of the plugin — its headline features (invitations, sub-teams, fine-grained permissions) are all req #2 ("out of scope"). The native cost is small by comparison: two collections, one repo, a role enum, a `can()` function, one verified-email field.

To keep a future migration *mechanical*, the native schema deliberately mirrors better-auth's: `workspaces` ≈ `organization`, `workspace_memberships` ≈ `member`. **Trigger conditions** that flip the recommendation: invitations become a priority, a second identity provider or email/password login is added, or fine-grained permissions are needed — at which point we'd want better-auth's *core* anyway, so lending it the `user` table stops being a tax. This ADR should be superseded then.

better-auth is MIT-licensed and runs as a library against our own Mongo, so adopting it later stays self-hostable and MIT-compatible (req #6) — and this is why proprietary hosted-auth (Auth0/Clerk/WorkOS) is ruled out: they gate orgs/SSO behind paid tiers. Adopting better-auth as the *auth core* (the multi-provider trigger) is a platform-wide, major-version change and **must not be bundled** with the workspaces toggle: workspaces is a toggleable module; the auth core is a separate platform decision.

### 6. API surface

All routes register under the `workspaces` slice, require auth, and are gated **server-side** by the §8 per-user flag (not just in the UI): a caller lacking the `featureFlags.workspaces` flag ⇒ `404`/`403`.

- `POST /api/v1/workspaces` — create `{ name, slug }`; `403` if email unverified; creator gets an owner membership.
- `GET /api/v1/workspaces` — list workspaces I'm a member of.
- `GET /api/v1/workspaces/:workspaceSlug` — detail; `403`/`404` if not a member.
- `PATCH /api/v1/workspaces/:workspaceSlug` — update `{ name, slug }`.

URLs are **slug-based** (`:workspaceSlug`, not `:workspaceId`). Every `Workspace` has a required, unique, lowercase `slug` validated against the shared `SLUG_PATTERN`/`SLUG_MAX` (50) in `src/shared/utils/slugify.ts` (the single source of truth `workspaces.schemas.ts` also consumes); the validator additionally rejects reserved words and consecutive hyphens. The user supplies the slug (the client previews a derived one live, but the backend does not auto-derive); a taken slug surfaces `WORKSPACE_SLUG_TAKEN`. No backfill — slugs ship with workspaces. (Client ADR-005 had deferred slugs as "backend cost"; that reversed because shareable readable URLs like `/workspaces/acme-marketing/feeds` are materially better and the uniqueness cost proved small with no backfill.)

Member-management endpoints (and the owner-only `deleteWorkspace`/`transferOwnership`) are not built (req #2); the `can()` seam and the membership collection make them additive (§10).

### 7. Feeds are owned by workspaces

`UserFeed` carries a real, indexed `workspaceId` (`ObjectId`). Feeds with `workspaceId` set belong to a workspace; `workspaceId: null` is personal.

- **Authorization is membership-based.** Feed and connection handlers authorize workspace-feed operations by checking the caller is a member of the feed's workspace (via `WorkspaceMongooseRepository.listWorkspaceIdsForUser`). The §2 collection is the authz input, exactly as designed.
- **Workspace feeds have their own quota**, enforced via `SupportersService.getWorkspaceBenefits(workspaceId)`. Billing is on only when `BACKEND_API_ENABLE_SUPPORTERS` is set AND Paddle is configured (`isBillingEnabled`). With billing on, the workspace subscription tier dictates the cap (no active subscription is dormant: zero feeds). With billing off (self-host), feeds are unlimited unless the operator opts into a cap via `BACKEND_API_DEFAULT_MAX_WORKSPACE_FEEDS`. Counted via `countByWorkspace(workspaceId)`, never against the creator's personal quota.
- **Insulated from personal supporter perks.** Every enforcement query keyed on personal supporter benefits (refresh rate, daily-article limits, personal feed count) excludes workspace feeds with an explicit `{ workspaceId: null }` filter. Workspace feeds are governed only by `getWorkspaceBenefits`.
- **Scope isolation.** `getUserFeeds()` with a `workspaceId` returns only that workspace's feeds; without one, only personal feeds (`workspaceId: null`). A workspace's feeds never appear on the personal dashboard or vice versa.

### 8. Self-host opt-in/out, licensing, and cost (req #6)

**Single per-user gate:**

| Layer | Mechanism | Audience | Default |
|---|---|---|---|
| **Per-user feature flag** | `User.featureFlags.workspaces` → `/users/@me` | self-hoster / hosted gradual rollout | off |

`User.featureFlags.workspaces` is the sole gate. The workspace and email-verification routes always register; `requireWorkspacesFeatureHook` returns 404 for any user without the flag, so the feature is inert for everyone until the flag is set on a user. (An earlier design also had a deployment-level `BACKEND_API_WORKSPACES_FEATURE_ENABLED` env toggle; it was removed in favor of relying solely on the per-user flag, which already hides the feature and requires no env/compose change to enable per user.) SMTP stays optional — without it, email verification returns `EMAIL_VERIFICATION_UNAVAILABLE`. This clean opt-out is exactly what the no-Discord-coupling vertical slice (§1) buys.

**Licensing/cost:** every dependency the feature adds is permissive (the native model is first-party; mail is nodemailer/MIT over operator SMTP; better-auth, if later adopted, is MIT). No proprietary email API, no managed auth, no metered/per-seat tier. A self-hosted instance needs only Mongo (already required) plus its own SMTP — both free.

**Operational consequence — replica-set Mongo.** Two operations are transactional and so require a replica set: workspace *creation* writes the workspace + owner membership in one transaction (atomicity over a compensating-delete alternative), and workspace *deletion* (when built, §10) must resolve its feeds in the same transaction (default policy: block while feeds exist) so no `workspaceId` ever dangles. Mongo transactions require a replica set, so any deployment that *enables* workspaces must run Mongo as a replica set. Dev/test composes already do; `docker-compose.base.yml` runs standalone `mongod` and must migrate before workspaces is enabled there — a compose change deferred to a major release. Workspaces-disabled deployments (the default) are unaffected.

### 9. Forward compatibility: other auth methods (seams now, no build)

Keeping `discordUserId` out of the workspace model is what lets other logins be added later. Following the "design the seam, don't build the feature" stance:

**Add now (cheap):**
- **Resolve identity to an internal `request.userId` at the auth boundary** (ideally stored in the session at login). New code consumes `request.userId`, not `request.discordUserId`; a future auth method becomes "a new way to populate `request.userId`" with no internal change.
- **`verifiedEmail` is unique** (§4) — the OTP send/confirm we build is most of an email/OTP login already; the only difference is that confirm would issue a session instead of setting a flag.

**Deferred — ONE slot, filled ONE of two ways (not both):** an account/identities model mapping internal `userId` ← `(provider, providerAccountId)`, with Discord as the first record. When another method becomes real, pick either a native `identities` collection (lighter; right when existing users just link a second provider) **or** better-auth's `account` table (heavier; right for first-class non-Discord accounts, many providers, MFA — but takes ownership of `user`/`session`, §5). The seams above are identical for both, so deferring costs nothing. **The one path to avoid is building native and *then* migrating to better-auth** — let the leaning be set by an honest read of the trajectory.

**Honest boundary:** the seams fully cover *linking a second login to an existing user* (everyone still has a `discordUserId`, so the legacy app is untouched). *First-class Discord-less accounts* additionally need the legacy delivery/supporter code decoupled from `discordUserId`, which stays deferred until a Discord-less user is a real requirement.

### 10. Member invitations — tokenless, OTP-gated acceptance model

**Status update (workspace invitations, 2026-06-07):** the invitation lifecycle described below supersedes the earlier draft in this section, which specified an accept-link token that would set `verifiedEmail`. That model is deliberately reversed because it would re-open the Discord-email-spoofing hole this ADR's §4 closes (see security invariant below).

Two guardrails keep invitations consistent with the rest of the model:
- **`workspace_memberships` is `userId`-keyed** (§2) — a membership only ever exists for a real account.
- **Invitations are a separate, *email*-keyed `WorkspaceInvite` collection** — because at invite time the invitee may not have an account. You invite a person by email, not a Discord user.

**Security invariant (pinned by regression test):** `verifiedEmail` is written **exclusively** by `EmailVerificationService.confirm` — the one-time-code flow (§4). The Discord OAuth sign-in path (`initDiscordUser`) writes only the `email` field, never `verifiedEmail`. This invariant holds for the entire invitation lifecycle: the invitation notification email contains a deep link keyed by invitation id; the link is a notification only and confers no authority on its own. **There is no accept-link token.**

**Lifecycle when accepting:** accept and decline are both gated server-side on `user.verifiedEmail === invite.email`. The three cases:

| `verifiedEmail` state | Result |
|---|---|
| unset | email-unverified error (carry invited email in payload) |
| set to a different address | email-mismatch error (carry both addresses in payload) |
| set to the invited email | proceed |

Acceptance is transactional: delete the `WorkspaceInvite` row and insert the `WorkspaceMembership` row in one transaction (mirroring `createWorkspaceWithOwner`). The accepted role is stamped on the invitation and copied to the membership.

**Why not an accept-link token that sets `verifiedEmail`:** an attacker can set their Discord account's email to any victim address. If clicking a forwarded or intercepted link could set `verifiedEmail`, the spoofing hole §4 closes would be re-opened. Proof of email control must always come from the OTP flow — which delivers a code to the inbox, not to the HTTP client.

The `can(action, role)` seam (§3) covers the invitations authorization actions: `manageMembers` (invite / revoke) for owner and admin; `removeMember` (owner only) and `leaveWorkspace` (owner or admin) for membership mutations. The §2 `countOwners` check guards leave and remove to enforce the "at least one owner" invariant.

Member removal and ownership transfer: removal runs inside a transaction with the owner-count re-check, rejecting with `CANNOT_REMOVE_LAST_OWNER` if the action would leave the workspace ownerless.

**Status update (ownership transfer, 2026-06-13):** ownership transfer is now built; this supersedes the "transfer is deferred / v1 owners cannot leave a populated workspace" note that previously closed this paragraph. An owner can hand the owner role to an existing **admin** member.

- **It is a pure role swap, not a billing move.** The Paddle subscription lives on `workspace.paddleCustomer` (the workspace, not the membership), so the transfer touches no Paddle state: it promotes the target to `owner` and demotes the caller to `admin` in one transaction (`WorkspaceMongooseRepository.transferOwnership`, mirroring `removeMembership`), promoting before demoting so the owner count never dips below one. The caller stays a member (as an admin) and may leave afterward via `leaveWorkspace`.
- **The target must be a verified admin.** Eligibility is: a current member with role `admin`, a different user than the caller, and a set `verifiedEmail`. The owner is the billing payer, so proven mailbox control is load-bearing — the same gate the invitation flow (above) enforces. In practice every member already has a `verifiedEmail` (they got one to create the workspace or to accept an invite), so the check is cheap defense-in-depth, not a new barrier. An ineligible target is rejected with `WORKSPACE_TRANSFER_TARGET_INVALID`; an unverified one with `EMAIL_NOT_VERIFIED`.
- **It is unilateral and immediate.** No accept/decline handshake — the target is already a vetted admin and the owner is acting deliberately behind a confirm step. The new owner is notified by email (best-effort; a send failure never fails a committed transfer).
- **Authorization stays in the `can()` seam.** The handler checks `can("transferOwnership", role)` (owner-only); the actor-vs-target identity validation lives in the service method, keeping `can()` a pure `(action, role)` function (§3). Endpoint: `POST /api/v1/workspaces/:workspaceSlug/members/:userId/transfer-ownership`.
- **Known limitation, accepted deliberately:** because a Paddle subscription is bound to its Paddle customer, the transferred workspace's subscription remains the *previous* owner's customer of record (invoices, tax, receipts addressed to them) until the new owner updates the payment method through the existing owner-gated flow — which becomes available to them the moment they hold the owner role. Updating the card changes who pays, not whose account it is. A true customer-of-record detach would require cancel + re-subscribe and is out of scope. The new-owner notification surfaces this billing tail when a live subscription exists.

## Consequences

**Easier:**
- "Workspaces I'm in" is one indexed query; the chooser is cheap.
- Adding a role is enum + `can()` clause — no migration.
- The workspace model has no Discord knowledge, so a provider swap doesn't touch it (ADR-004 alignment).
- A future better-auth migration is a table re-map, not a redesign.
- Invitations and other logins are additive (§9/§10), not rewrites.

**Harder:**
- Two collections to keep consistent (create-workspace writes both in one transaction; reads treat an orphan workspace as inaccessible).
- A second identity concept (`userId` for workspaces vs `discordUserId` for the legacy app) lives in the codebase until the legacy app is decoupled (deferred, §9). Bridging handlers resolve `discordUserId → IUser.id` via the existing `findIdByDiscordId` (or the `request.userId` seam).

**Lost:**
- The "everything keyed on `discordUserId`" simplicity — given up deliberately for provider-agnosticism.
- The out-of-the-box invitation/permission machinery better-auth would have provided — not a real loss at this scope (§10), and better-auth remains the escalation path (§5/§9).

## Alternatives considered

- **A flat `admin`/`member` role model with a read-only member tier.** Rejected — collaboration on feeds means every member needs to edit, so a read-only tier is friction without benefit. The real distinction is owner-only destructive actions (delete, transfer), which `owner`/`admin` captures (§3). The enum stays open-ended, so a finer model remains additive.
- **Embedded `members[]` on the workspace doc.** Rejected — the precedent keys on `discordUserId` (violates decoupling) and makes "my workspaces" a scan.
- **Key membership on `discordUserId` for feed consistency.** Rejected by maintainer constraint — couples workspaces to Discord, contradicts the destination roadmap.
- **Seed `emailVerified` from Discord's OAuth `verified` flag.** Rejected (§4) — a mutable OAuth claim proves Discord's belief, not mailbox control; can't anchor the gate.
- **Separate email + password to create a workspace.** Rejected (§4) — adds hash custody, reset flows, and credential-stuffing surface plus a second secret, for no gain over proving ownership once.
- **Magic link instead of OTP.** Rejected (§4) — links break cross-device and get consumed by scanners that prefetch URLs. Near-identical storage, so reversible; code is the default.
- **Hosted auth/SaaS (Auth0/Clerk/WorkOS) or a proprietary email API (SendGrid/Postmark), incl. better-auth's *managed* email service.** Rejected — proprietary and/or paid; gate orgs/SSO or email behind tiers, violating req #6. (Flagged because better-auth's managed email "is right there" if the library is adopted — it stays off; mail always goes through operator SMTP.)
- **Adopt better-auth's organization plugin now / build the identities model now.** Deferred (§5/§9) — speculative with only Discord; the cheap seams keep both additive. Re-evaluate at the trigger conditions.
- **Couple the workspaces toggle to a better-auth auth-core adoption.** Rejected — swapping the login system is platform-wide and major-version; the workspaces opt-in stays a small isolated module toggle.
