# RunComp Autonomous Development Goal

Work autonomously for a long local development session.

## Primary mission

Iterate on RunComp locally by adding useful features, improving quality, strengthening tests, and polishing UX. Prioritize changes that make the app better for a small private running group/family/homelab deployment. Everything you add must be testable by you without human intervention.

## Repository context

RunComp is a small running competition app for private groups. It supports logging miles, group codes, member passwords, owner controls, totals, weekly/monthly/all-time stats, leader/gap comparison, streaks, charts, weekly challenges, recaps, runner profiles, push alerts, JSON backup, CSV export, and file-backed persistence through DATA_DIR.

## Tech context

- Package manager: pnpm
- Framework: Next.js / React / TypeScript
- Tests: Jest
- Quality commands:
  - `pnpm install`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Treat `pnpm lint`, `pnpm test`, and `pnpm build` as the minimum validation gate before considering a change complete.

## Operating rules

1. Work in small, reviewable increments.
2. Before changing code, inspect the repo structure, package scripts, existing tests, app routes, API routes, store/persistence layer, and roadmap files.
3. Do not invent large architecture rewrites unless the current code clearly requires it.
4. Keep the app local-first and file-backed unless a feature absolutely requires otherwise.
5. Do not add external services, databases, auth providers, analytics, cloud backup, or scheduled jobs.
6. Do not add features that require secrets, paid accounts, manual setup, or human intervention to test.
7. Avoid breaking existing data shape. If changing persisted data, add a safe migration or backward-compatible handling.
8. Owner-only behavior must be enforced server-side, not only hidden in UI.
9. All new behavior must have automated tests where practical.
10. Favor focused, production-quality improvements over broad unfinished feature stubs.
11. Keep mobile UX in mind. This is likely used from phones.
12. Preserve the simple family/private-group feel. Do not turn this into a public social platform.

## Development loop

Repeat this loop until stopped:

### 1. Inspect current state

- Read `README.md`.
- Read `ROADMAP` files.
- Inspect `package.json` scripts.
- Inspect `app/`, `lib/`, API routes, tests, and existing UI patterns.
- Run baseline validation:
  - `pnpm install` if needed
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- If baseline fails, fix the baseline first before adding features.

### 2. Choose the next best task

Prioritize in this order:

1. Fix failing tests/build/type errors.
2. Add or improve tests for existing critical behavior.
3. Finish 0.3.1 roadmap items that are already partially implemented.
4. Improve owner/settings/backup/export UX.
5. Improve runner profile empty states and useful stats.
6. Improve notification settings clarity without expanding the push system too much.
7. Refactor only when it reduces risk, improves testability, or removes duplication.

### 3. Implement one coherent change at a time

- Keep diffs focused.
- Add tests before or alongside implementation.
- Prefer explicit store methods over direct mutation from route handlers.
- Validate API inputs.
- Preserve security boundaries.
- Avoid exposing password hashes/secrets in normal user-facing exports.
- Make errors understandable in UI and API responses.

### 4. Self-test

After each coherent change, run:

- `pnpm lint`
- `pnpm test`
- `pnpm build`

If any command fails:

- Diagnose.
- Fix.
- Re-run the relevant command.
- Do not move on while the repo is broken.

### 5. Commit discipline

After a validated coherent change, create a git commit with a clear message.
Use conventional-ish messages when possible:

- `feat: ...`
- `fix: ...`
- `test: ...`
- `refactor: ...`
- `docs: ...`
- `chore: ...`

Do not commit broken code.
Do not commit generated junk, local data, secrets, `.env` files, `node_modules`, or build artifacts.

### 6. Maintain a progress log

Keep or create a local agent progress file, for example:

- `AGENT_PROGRESS.md`

Update it after each completed increment with:

- What changed
- Files touched
- Tests added/updated
- Validation commands run
- Known follow-ups
- Any skipped idea and why

## Suggested high-value tasks

Use judgment based on current code, but these are strong targets:

### 1. Settings screen polish

- Centralize group controls, runner management, backup/export, notification status, app version, logout/switch group.
- Keep it compact and task-oriented.
- Add tests for any route/store behavior behind the screen.

### 2. Owner member-management hardening

- Ensure owner can edit runner display name, reset password, remove/deactivate inactive runner, and copy invite/login link if existing design supports it.
- Enforce authorization in API routes/store functions.
- Add tests for unauthorized users, owner success paths, missing member, duplicate names, and invalid inputs.

### 3. Backup/export quality

- Ensure JSON backup is suitable for recovery by an owner.
- Ensure CSV export is spreadsheet-friendly.
- Ensure normal export does not leak password hashes or secrets unless it is explicitly a full owner backup.
- Add focused tests for output shape and sensitive-data handling.

### 4. Runner profile follow-up

- Improve empty states for new runners.
- Add richer recent trend display if existing data supports it.
- Add head-to-head stats only if it can be tested cleanly with existing run data.
- Avoid complex chart libraries unless already present.

### 5. Notification settings clarity

- Show current push subscription status.
- Explain unsupported, blocked, denied, or disabled states.
- Add disable/unsubscribe behavior only if it can be implemented and tested without manual browser push setup.
- Avoid complicated per-event toggles unless the current model already supports them.

### 6. Test coverage and reliability

- Add store tests for core calculations: totals, streaks, averages, longest run, weekly/monthly windows, challenge completion, leader/gap logic.
- Add route tests for auth/owner checks.
- Add regression tests before risky fixes.
- Improve test fixtures/builders if tests are repetitive.

### 7. Deployment/homelab polish

- Improve README only when it reflects actual behavior.
- Add clear environment variable documentation.
- Add health/deployment notes only if verified.
- Do not add Docker or CI unless it can be tested locally and fits the repo.

## Quality bar

- TypeScript must be strict enough to catch mistakes.
- No obvious runtime exceptions in normal flows.
- No unhandled promise paths in API routes.
- No unsafe trust in client-provided owner/member identity.
- No password or secret leakage in normal UI/API/export.
- Tests should cover the behavior, not just implementation details.
- UI copy should be clear and short.

## Definition of done for each increment

- Feature/fix is implemented.
- Automated tests were added or updated when practical.
- `pnpm lint` passes.
- `pnpm test` passes.
- `pnpm build` passes.
- `AGENT_PROGRESS.md` is updated.
- Commit is created.

Do not stop after one task. Continue selecting the next best task and repeating the loop until the session is stopped.

At the end of the session, leave the repo in a clean, validated state and summarize in `AGENT_PROGRESS.md`:

- Commits made
- Features/fixes completed
- Validation status
- Any remaining risks or recommended next steps

## Active Session Notes

- 2026-05-28: Baseline validation passed with `pnpm install`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- 2026-05-28: First increment selected from 0.3.1 priorities: API route tests for owner-only runner management and full backup export boundaries.
- 2026-05-28: Second increment extended API route coverage to group creation, owner-only race goal updates, and owner-generated runner login links.
- 2026-05-28: Third increment improved owner Settings export visibility with local last-request tracking for JSON backup and CSV export.
- 2026-05-28: Fourth increment hardened push unsubscribe cleanup so client-provided endpoints are scoped to the signed-in member.
- 2026-05-28: Fifth increment improved runner profile empty states and recent activity summary copy.
- 2026-05-28: Sixth increment hardened CSV exports against spreadsheet formula injection from runner names and notes.
- 2026-05-28: Seventh increment added `/api/runs` route coverage and tightened run date validation to reject impossible calendar dates.
- 2026-05-28: Eighth increment added a compact group settings notification status block for current-device alert clarity.
- 2026-05-28: Ninth increment added `/api/session` route coverage for current session, password login, invite login, and logout flows.
- 2026-05-28: Tenth increment added compact install/PWA status guidance to the group settings area.
- 2026-05-28: Eleventh increment updated README deployment/configuration notes to match current file-backed, push, and export behavior.
- 2026-05-28: Twelfth increment added tested runner profile head-to-head comparisons.
- 2026-05-28: Thirteenth increment hardened store-level run validation for miles, calendar dates, and durations.
- 2026-05-28: Fourteenth increment added invite-token auth tests for signing, tamper rejection, expiry, malformed tokens, and claim validation.
- 2026-05-28: Fifteenth increment reduced API route test duplication with shared request/JSON helpers.
- 2026-05-28: Sixteenth increment cleaned up repeated Settings status-row styling for notification and install state.
- 2026-05-28: Seventeenth increment added push sender tests for notification payloads and expired-subscription cleanup.
- 2026-05-28: Eighteenth increment added owner member-management store regression tests for duplicate names, missing runners, and invalid password resets.
- 2026-05-28: Nineteenth increment enforced owner actor checks inside `removeInactiveMember` at the store layer.
- 2026-05-28: Twentieth increment required explicit owner actors for member create, rename, and password reset store methods.
- 2026-05-28: Twenty-first increment required explicit owner actors for store-level race goal updates.
- 2026-05-28: Twenty-second increment removed trusted caller roles from store-level run deletion authorization.
- 2026-05-28: Twenty-third increment required persisted members for store-level run reactions.
- 2026-05-28: Twenty-fourth increment made runner profile titles and card rarity more prominent with tested shared metric helpers.
- 2026-05-28: Twenty-fifth increment removed duplicate 5K achievement badges from runner shelves.
- 2026-05-28: Twenty-sixth increment added route-level validation for malformed owner runner edit requests.
- 2026-05-28: Twenty-seventh increment rejected unsupported export types before generating downloads.
- 2026-05-28: Twenty-eighth increment expanded push route tests for VAPID key setup and unsubscribe auth.
- 2026-05-28: Twenty-ninth increment made weekly badge calculation deterministic with an injectable date.
- 2026-05-28: Thirtieth increment shared one page-level metrics timestamp across date-sensitive UI calculations.
- 2026-05-28: Thirty-first increment added route-level validation for malformed owner runner creation requests.
- 2026-05-28: Thirty-second increment added route-level race-goal number validation for group creation and updates.
- 2026-05-28: Thirty-third increment added JSON object guards for run logging and reaction routes.
- 2026-05-28: Thirty-fourth increment added a JSON object guard for owner invite-link requests.
- 2026-05-28: Thirty-fifth increment added JSON object guards for push subscribe and unsubscribe routes.
- 2026-05-28: Thirty-sixth increment shared JSON object route guards and applied them to group, member, and session mutations.
- 2026-05-28: Thirty-seventh increment added challenge completion timestamp regression coverage.
- 2026-05-28: Thirty-eighth increment made notification unsubscribe success depend on API and browser unsubscribe success.
- 2026-05-28: Thirty-ninth increment moved CSV export into general settings while keeping JSON backup owner-only.
