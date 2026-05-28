# Agent Progress

## 2026-05-28

### Increment 1: Owner Route Coverage

- What changed: Added route-level tests for `/api/members` and `/api/exports` to verify server-side owner checks, explicit member-management store method calls, signed-in CSV export access, and owner-only JSON backup access.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/members-route.test.ts`
  - `app/api/__tests__/exports-route.test.ts`
  - `jest.setup.ts`
- Tests added/updated:
  - Added 11 API route tests.
  - Updated `jest.setup.ts` so Node-environment route tests can coexist with jsdom component tests.
- Validation commands run:
  - `pnpm install`
  - `pnpm test -- app/api/__tests__/members-route.test.ts app/api/__tests__/exports-route.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Add route tests for invite generation and group goal owner checks.
  - Improve Settings/owner UX around backup/export and notification status.
- Skipped ideas:
  - Did not change backup data shape in this increment; existing store tests already verify sanitized exports, and changing backup semantics should be handled deliberately with migration/restore planning.

### Increment 2: Setup And Invite Route Coverage

- What changed: Added route-level tests for `/api/groups` and `/api/invites` to verify group creation sets the owner session, store validation errors are returned safely, race goal updates are owner-only, login links are owner-only, and invite tokens can only be created for runners in the current group.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/groups-route.test.ts`
  - `app/api/__tests__/invites-route.test.ts`
- Tests added/updated:
  - Added 9 API route tests.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/groups-route.test.ts app/api/__tests__/invites-route.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Add route tests for run logging/deletion/reactions and push subscription endpoints.
  - Move from route hardening into Settings UX polish once the critical API boundary coverage is less thin.
- Skipped ideas:
  - Did not change invite token behavior; current flow already uses signed, expiring tokens and the tests now pin the owner/current-group boundaries.

### Increment 3: Export History In Owner Settings

- What changed: Added local, per-group export request history for JSON backups and CSV downloads, then surfaced the last request timestamps in the owner Settings area.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
  - `app/globals.css`
  - `lib/export-history.ts`
  - `lib/__tests__/export-history.test.ts`
- Tests added/updated:
  - Added 4 tests for export-history storage, corrupt data handling, and timestamp formatting.
- Validation commands run:
  - `pnpm test -- lib/__tests__/export-history.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Consider making backup/download success more explicit if exports move from browser navigation to fetch-based downloads.
  - Continue Settings polish around notification status and install/PWA status.
- Skipped ideas:
  - Did not add persisted server-side backup timestamps; local request history is simpler, testable, and avoids changing the file-backed data shape.

### Increment 4: Push Unsubscribe Hardening

- What changed: Scoped push subscription removal to the signed-in member so one runner cannot remove another runner's subscription by submitting an endpoint. Expired-subscription cleanup now uses the subscription's stored member id.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/push/route.ts`
  - `app/api/__tests__/push-route.test.ts`
  - `lib/store.ts`
  - `lib/push.ts`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added push route tests for authenticated save/delete behavior.
  - Added a store regression test proving another member cannot remove someone else's push subscription.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts app/api/__tests__/push-route.test.ts`
  - `pnpm test`
  - `pnpm build`
  - `pnpm lint`
- Known follow-ups:
  - Add tests around expired push subscription cleanup if the push sender gets easier to mock cleanly.
  - Continue notification settings clarity in the UI.
- Skipped ideas:
  - Did not add per-event notification toggles; the current push model is intentionally simple and the roadmap says to avoid expanding it unless the model already supports it cleanly.

### Increment 5: Runner Profile Empty State

- What changed: Improved runner profile modals with a compact run summary, 14-day activity count for active runners, and clear empty-state copy for new runners without achievements.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - No new automated tests; this was a narrow presentational copy/layout change using existing computed metrics.
- Validation commands run:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Add head-to-head profile stats if it can be kept compact and tested cleanly.
  - Consider extracting profile summary calculations if more profile-specific metrics are added.
- Skipped ideas:
  - Did not add a new chart library or complex trend visualization; the existing streak strip already covers lightweight recent activity.

### Increment 6: CSV Formula Injection Hardening

- What changed: CSV export now prefixes cells that could be interpreted as spreadsheet formulas, covering user-controlled runner names and run notes while preserving normal CSV quoting.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/store.ts`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added a store export regression test for formula-like runner names and notes.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider adding route-level tests for `/api/runs` validation and notification side effects.
  - Consider documenting export safety behavior in README if export/import documentation expands.
- Skipped ideas:
  - Did not change JSON backup shape; this increment was limited to spreadsheet-facing CSV safety.

### Increment 7: Run Route Coverage And Date Validation

- What changed: Added route-level tests for `/api/runs` covering session requirements, run input validation, successful run logging, lead-change notification dispatch, reaction validation, and delete behavior. Tightened date validation so impossible calendar dates like `2026-02-31` are rejected instead of being normalized by `Date.parse`.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/runs/route.ts`
  - `app/api/__tests__/runs-route.test.ts`
- Tests added/updated:
  - Added 8 API route tests.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/runs-route.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add route tests for challenge-completion notification dispatch if mocking date-dependent challenge inputs stays readable.
  - Consider moving shared route-test fixture helpers into a small local test utility if route tests grow much more.
- Skipped ideas:
  - Did not refactor `/api/runs` notification orchestration; the route is still understandable, and this increment focused on pinning behavior before any structural change.

### Increment 8: Notification Status In Group Settings

- What changed: Added a compact notification status block to the group/settings area so users can see the current device state for alerts: checking, updating, on, off, blocked, or unavailable. The block reuses the existing enable/disable flow and keeps unsupported/blocked states explanatory.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - No new automated tests; this is a presentational state/copy change using existing push status state and controls.
- Validation commands run:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Add focused component coverage if the main app UI gets split into smaller testable pieces.
  - Consider a similarly compact install/PWA status row for Settings.
- Skipped ideas:
  - Did not add per-event notification toggles; the current push system remains intentionally simple.

### Increment 9: Session Route Coverage

- What changed: Added route-level tests for `/api/session` covering unauthenticated reads, authenticated context reads, password login, invite-token login, invalid/stale invite handling, login errors, and logout cookie clearing.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/session-route.test.ts`
- Tests added/updated:
  - Added 9 API route tests.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/session-route.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Route coverage now spans the main API surface; future route tests should focus on regressions or tricky notification/challenge paths.
  - Consider extracting shared route-test fixtures if new route tests add more duplicate setup.
- Skipped ideas:
  - Did not alter session token behavior; this increment pins current behavior for safer future changes.

### Increment 10: Install Status In Settings

- What changed: Added a compact install-status row to the group/settings area that tells users whether RunComp is opening like an installed app, running in browser mode, or needs iOS Home Screen install for app-style launch and push support.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - No new automated tests; this is a presentational browser-state copy change using existing standalone/iOS detection helpers.
- Validation commands run:
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider extracting Settings rows into small components if the main page keeps growing.
  - Consider adding component tests once the Settings area is easier to render in isolation.
- Skipped ideas:
  - Did not add custom install-prompt handling; browser install support varies and the existing local-first guidance is enough for the homelab/private-group scope.

### Increment 11: README Configuration Polish

- What changed: Updated README features and deployment/configuration notes to document runner login links, spreadsheet-safe CSV exports, `PORT`, `ALLOWED_DEV_ORIGINS`, static VAPID keys, public app URL-derived VAPID subjects, and sanitized backup/export behavior.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `README.md`
- Tests added/updated:
  - No tests added; this is documentation aligned with existing verified behavior.
- Validation commands run:
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add restore/import documentation only if a verified import flow is implemented later.
  - Consider a short troubleshooting section if deployment issues emerge from actual use.
- Skipped ideas:
  - Did not add Docker or CI; the goal file explicitly says not to add those unless they can be tested locally and fit the repo.

### Increment 12: Runner Profile Head-To-Head Stats

- What changed: Added tested head-to-head comparison metrics and surfaced the closest runner comparisons inside each runner profile. Profiles now show whether the runner is ahead, behind, or tied against other group members.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/run-metrics.ts`
  - `lib/__tests__/run-metrics.test.ts`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - Added a run-metrics test for closest-gap head-to-head ordering, behind status, and miles-to-pass calculations.
- Validation commands run:
  - `pnpm test -- lib/__tests__/run-metrics.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider adding week-only head-to-head comparisons if profile density still feels manageable.
  - Consider extracting profile sections if the modal grows further.
- Skipped ideas:
  - Did not add a chart library or larger profile redesign; this stayed within existing data and UI patterns.

### Increment 13: Store-Level Run Validation

- What changed: Hardened `addRun` in the file-backed store so direct store callers get the same basic validation guarantees as the API route: miles must be within range, dates must be real `YYYY-MM-DD` calendar dates, and durations must be positive and no more than 48 hours.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/store.ts`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added a store regression test proving invalid run inputs are rejected before writing.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider sharing run input validation between route and store if more run fields are added.
  - Consider stricter future-date policy only if the group wants it; current behavior still allows backfilled/future-dated runs as before.
- Skipped ideas:
  - Did not change persisted data shape or migrate existing runs; this only guards new writes.

### Increment 14: Invite Token Auth Coverage

- What changed: Added focused tests for invite-token signing and verification, including valid scoped claims, tampered payload/signature rejection, expired token rejection, wrong-kind rejection, bad-role rejection, and malformed token rejection.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/auth.test.ts`
- Tests added/updated:
  - Added 3 auth tests covering invite token behavior.
- Validation commands run:
  - `pnpm test -- lib/__tests__/auth.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add session-cookie tests only if `next/headers` cookie mocking can stay clean and useful.
  - Keep route-level session tests as the main coverage for cookie-setting behavior.
- Skipped ideas:
  - Did not change token format or TTL; this increment pins existing behavior.

### Increment 15: Route Test Helper Cleanup

- What changed: Added a small shared route-test utility for JSON request construction and JSON response parsing, then updated API route tests to use it.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/route-test-utils.ts`
  - `app/api/__tests__/exports-route.test.ts`
  - `app/api/__tests__/groups-route.test.ts`
  - `app/api/__tests__/invites-route.test.ts`
  - `app/api/__tests__/members-route.test.ts`
  - `app/api/__tests__/push-route.test.ts`
  - `app/api/__tests__/runs-route.test.ts`
  - `app/api/__tests__/session-route.test.ts`
- Tests added/updated:
  - No new behavior tests; updated existing route tests to share helpers.
- Validation commands run:
  - `pnpm test -- app/api/__tests__`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider extracting shared auth/store mock factories only if route test setup keeps expanding.
- Skipped ideas:
  - Did not refactor route mocks in this increment; helper cleanup kept the diff mechanical and low-risk.

### Increment 16: Settings Status Row Style Cleanup

- What changed: Consolidated notification and install Settings row styling under a shared `settingsStatusBlock` class to reduce duplicated CSS and keep future Settings rows consistent.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - No behavior tests added; this was a styling refactor with unchanged UI behavior.
- Validation commands run:
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Continue extracting small Settings primitives if the page grows further.
- Skipped ideas:
  - Did not split Settings into React components yet; that would be a larger refactor and is only worth doing with stronger component-test plans.

### Increment 17: Push Sender Coverage

- What changed: Added focused tests for push notification sending, verifying run notification payloads, VAPID configuration use, and expired-subscription cleanup while preserving non-expired send failures for logging.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/push.test.ts`
- Tests added/updated:
  - Added 2 push sender tests.
- Validation commands run:
  - `pnpm test -- lib/__tests__/push.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add challenge notification payload tests if challenge copy changes become more frequent.
- Skipped ideas:
  - Did not change push behavior; this increment pins existing cleanup and payload behavior.

### Increment 18: Member Management Store Regression Tests

- What changed: Added store regression coverage for duplicate display-name edits, missing runner edits, missing runner password resets, invalid password resets, and preserving existing credentials after rejected changes.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added 1 focused store test covering multiple owner member-management failure paths.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add UI-level tests only if member-management controls get split into a renderable component.
- Skipped ideas:
  - Did not change member-management behavior; the existing store checks were correct and now have stronger regression coverage.

### Increment 19: Store Owner Check For Runner Removal

- What changed: Hardened `removeInactiveMember` so the file-backed store verifies the actor exists and has the owner role before removing an inactive runner, matching the server route authorization boundary.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/store.ts`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added a store regression test for non-owner and missing-actor removal attempts.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep store methods explicit about actor identity for future owner-only operations.
- Skipped ideas:
  - Did not change the route handler; it already checks owner role before calling the store.

### Increment 20: Store Owner Actors For Member Management

- What changed: Updated member-management store methods so `addMember`, `updateMemberName`, and `resetMemberPassword` all require an explicit owner member id and verify that actor before mutating group membership or credentials. Updated the members API route to pass the signed-in owner id.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/store.ts`
  - `lib/__tests__/store.test.ts`
  - `app/api/members/route.ts`
  - `app/api/__tests__/members-route.test.ts`
- Tests added/updated:
  - Updated store and route tests for explicit owner actor arguments.
  - Added direct store checks proving non-owner actors cannot create members, rename runners, or reset runner passwords.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts app/api/__tests__/members-route.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider applying the same actor-explicit pattern to other owner-only store operations such as race goal updates if they become more complex.
- Skipped ideas:
  - Did not alter persisted data shape; this is a store authorization boundary change only.

### Increment 21: Store Owner Actor For Goal Updates

- What changed: Updated `updateGroupGoal` so the file-backed store verifies an explicit owner actor before changing the race goal. Updated the groups route to pass the signed-in owner id.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/store.ts`
  - `lib/__tests__/store.test.ts`
  - `app/api/groups/route.ts`
  - `app/api/__tests__/groups-route.test.ts`
- Tests added/updated:
  - Updated store and route tests for explicit owner actor arguments.
  - Added a store assertion proving a non-owner cannot update the race goal directly.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts app/api/__tests__/groups-route.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Owner-only store operations now consistently take explicit owner actors.
- Skipped ideas:
  - Did not change the Settings UI for goal updates; this was a store authorization hardening increment.

### Increment 22: Store-Derived Run Delete Authorization

- What changed: Updated run deletion so the store derives the actor role from persisted group membership instead of trusting a caller-provided role. The runs API now passes only the signed-in member id and run id.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/store.ts`
  - `lib/__tests__/store.test.ts`
  - `app/api/runs/route.ts`
  - `app/api/__tests__/runs-route.test.ts`
- Tests added/updated:
  - Updated route coverage for the slimmer delete call.
  - Added a store assertion that missing actors cannot delete runs.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts app/api/__tests__/runs-route.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider validating reaction actors in `toggleRunReaction` so removed or unknown members cannot leave reactions.
- Skipped ideas:
  - Did not change the runs UI; this increment only tightens server/store authorization.

### Increment 23: Store Reaction Actor Validation

- What changed: Hardened `toggleRunReaction` so only persisted group members can add or remove reactions on runs.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/store.ts`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Extended store reaction regression coverage for missing reaction actors.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Review remaining store methods for any caller-provided identity or role trust as future small hardening tasks.
- Skipped ideas:
  - Did not alter reaction UI or reaction aggregation; this only rejects invalid actors before writes.

### Increment 24: Runner Profile Title And Rarity Polish

- What changed: Moved runner title and card rarity derivation into tested metrics helpers and surfaced both values as compact chips in the runner profile modal.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/run-metrics.ts`
  - `lib/__tests__/run-metrics.test.ts`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - Added metrics coverage for runner title priority and card rarity thresholds.
- Validation commands run:
  - `pnpm test -- lib/__tests__/run-metrics.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider reducing duplicate 5K achievement labels in a separate behavior-focused increment.
- Skipped ideas:
  - Did not add a component-render test for the full page; the derivation logic is covered at the metrics layer.

### Increment 25: Cleaner 5K Achievement Shelf

- What changed: Removed the duplicate 5K achievement so runner shelves no longer show both `5K logged` and `First 5K` for the same longest-run threshold.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/run-metrics.ts`
  - `lib/__tests__/run-metrics.test.ts`
- Tests added/updated:
  - Updated badge expectation tests to assert a single 5K achievement.
- Validation commands run:
  - `pnpm test -- lib/__tests__/run-metrics.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Revisit rarity thresholds later if real groups feel too slow or too fast to progress after the duplicate badge removal.
- Skipped ideas:
  - Did not add new achievements; this was a focused cleanup of existing profile output.
