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

### Increment 26: Member Edit Route Validation

- What changed: Added `/api/members` PATCH validation for missing runner ids, missing edit actions, and ambiguous name-plus-password edits before calling store mutation methods.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/members/route.ts`
  - `app/api/__tests__/members-route.test.ts`
- Tests added/updated:
  - Added route coverage proving malformed edit requests return 400 and do not call rename or password reset store methods.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/members-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider similar explicit route validation for member creation if owner setup copy needs more specific field-level errors.
- Skipped ideas:
  - Did not change store validation; the store still enforces name and password constraints for valid action shapes.

### Increment 27: Export Type Validation

- What changed: Tightened `/api/exports` so only `json` and `csv` export types are accepted; unsupported values now return a 400 instead of falling through to JSON backup behavior.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/exports/route.ts`
  - `app/api/__tests__/exports-route.test.ts`
- Tests added/updated:
  - Added route coverage for unsupported export types and verified no export store method is called.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/exports-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider adding a lightweight UI guard if new export formats are added later.
- Skipped ideas:
  - Did not add new export formats; this only makes the current API contract explicit.

### Increment 28: Push Route Coverage

- What changed: Expanded push API route tests around the public VAPID key endpoint and unsubscribe authentication.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/push-route.test.ts`
- Tests added/updated:
  - Added GET coverage for returning the VAPID public key.
  - Added DELETE coverage proving unauthenticated unsubscribe attempts do not call the store.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/push-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider checking the client-side unsubscribe fetch response before showing success.
- Skipped ideas:
  - Did not change push behavior in this increment; it only strengthens regression coverage.

### Increment 29: Deterministic Weekly Badge Date

- What changed: Updated `buildBadges` so the `3-run week` achievement can be evaluated against an explicit date while preserving the current default behavior for the UI.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/run-metrics.ts`
  - `lib/__tests__/run-metrics.test.ts`
- Tests added/updated:
  - Added metrics coverage proving the weekly badge is awarded or withheld based on the provided date.
- Validation commands run:
  - `pnpm test -- lib/__tests__/run-metrics.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider passing a shared `now` from the page to every date-sensitive metric helper if profile snapshots need to be frozen.
- Skipped ideas:
  - Did not change visual badge presentation; this increment only makes the calculation testable and deterministic.

### Increment 30: Shared Metrics Timestamp In UI

- What changed: Threaded a single page-level metrics timestamp through stats, chart, recap, challenge, feed, runner-card badge, and profile trend calculations.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
- Tests added/updated:
  - No new UI test was added; this wires existing tested metric helpers through the page with type coverage.
- Validation commands run:
  - `pnpm lint`
  - `pnpm test -- lib/__tests__/run-metrics.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add component-level page tests only if the monolithic page is split into smaller renderable sections.
- Skipped ideas:
  - Did not introduce a live clock; metrics refresh naturally when runs/session data refresh.

### Increment 31: Member Creation Route Validation

- What changed: Added `/api/members` POST validation for missing or blank runner names and missing runner passwords before calling the member-creation store method.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/members/route.ts`
  - `app/api/__tests__/members-route.test.ts`
- Tests added/updated:
  - Added route coverage proving malformed member creation requests return 400 and do not call `addMember`.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/members-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep store-level duplicate-name and password-strength checks as the source of truth for valid create-member payloads.
- Skipped ideas:
  - Did not add field-specific UI messages; the existing client already displays API errors.

### Increment 32: Group Goal Route Validation

- What changed: Added explicit race-goal number parsing in `/api/groups` so malformed group creation and goal update requests return 400 before any store mutation.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/groups/route.ts`
  - `app/api/__tests__/groups-route.test.ts`
- Tests added/updated:
  - Added route coverage for malformed group creation goal values.
  - Added route coverage for missing and malformed race-goal update values.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/groups-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Range limits remain enforced in the store so API and store behavior stay consistent.
- Skipped ideas:
  - Did not add new goal units or per-runner goals; this only tightens existing race-goal input handling.

### Increment 33: Run Route JSON Body Guards

- What changed: Added object-shape validation for `/api/runs` POST and PATCH requests so non-object JSON payloads return a clear 400 instead of causing field access failures.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/runs/route.ts`
  - `app/api/__tests__/runs-route.test.ts`
- Tests added/updated:
  - Added route coverage for null run-log and reaction request bodies.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/runs-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider extracting shared JSON object guards if more route handlers need the same hardening.
- Skipped ideas:
  - Did not change run field validation messages; existing miles/date/duration/reaction checks remain intact.

### Increment 34: Invite Route JSON Body Guard

- What changed: Added object-shape validation for `/api/invites` POST requests so malformed owner invite-link payloads return a clear 400 before token creation logic.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/invites/route.ts`
  - `app/api/__tests__/invites-route.test.ts`
- Tests added/updated:
  - Added route coverage for null invite request bodies.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/invites-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Consider extracting shared JSON object guards after the remaining mutable JSON routes are hardened.
- Skipped ideas:
  - Did not change invite token content or expiration behavior.

### Increment 35: Push Route JSON Body Guards

- What changed: Added object-shape validation for `/api/push` POST and DELETE requests so malformed push subscription payloads return clear 400 responses before store calls.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/push/route.ts`
  - `app/api/__tests__/push-route.test.ts`
- Tests added/updated:
  - Added route coverage for null push subscription save and removal request bodies.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/push-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Push subscription field validation still lives in the store, which keeps endpoint/key constraints centralized.
- Skipped ideas:
  - Did not expand the push system or add per-event toggles.

### Increment 36: Shared JSON Route Guard

- What changed: Extracted a shared `isJsonObject` API helper, reused it in the run, invite, and push routes, and applied it to group creation, goal updates, member creation, member edits, and session login.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/route-utils.ts`
  - `app/api/groups/route.ts`
  - `app/api/members/route.ts`
  - `app/api/session/route.ts`
  - `app/api/runs/route.ts`
  - `app/api/push/route.ts`
  - `app/api/invites/route.ts`
  - `app/api/__tests__/groups-route.test.ts`
  - `app/api/__tests__/members-route.test.ts`
  - `app/api/__tests__/session-route.test.ts`
- Tests added/updated:
  - Added non-object JSON body coverage for group creation, goal update, member creation, member edit, and session login.
  - Re-ran existing guarded route coverage for runs, push, and invites.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/groups-route.test.ts app/api/__tests__/members-route.test.ts app/api/__tests__/session-route.test.ts app/api/__tests__/runs-route.test.ts app/api/__tests__/push-route.test.ts app/api/__tests__/invites-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep route body-shape validation focused on mutation endpoints; read-only export routes do not need JSON body guards.
- Skipped ideas:
  - Did not add a schema library; the local helper keeps the app lightweight and dependency-free.

### Increment 37: Challenge Completion Timestamp Coverage

- What changed: Added regression coverage for challenge `completedAt` timestamps so notification de-duplication inputs stay stable.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/run-metrics.test.ts`
- Tests added/updated:
  - Updated the weekly challenge test to assert completion timestamps for weekly mileage, beat-last-week, everyone-logs, and weekend participation challenges.
- Validation commands run:
  - `pnpm test -- lib/__tests__/run-metrics.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add a focused most-consistent completion timestamp case if that challenge behavior changes.
- Skipped ideas:
  - Did not change challenge calculation behavior; this increment only strengthens regression coverage.

### Increment 38: Notification Unsubscribe Failure Handling

- What changed: Updated the client notification toggle so disabling alerts only reports success after both `/api/push` cleanup and browser `unsubscribe()` succeed. Failed disable attempts now keep the status as subscribed instead of incorrectly showing alerts as off.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
- Tests added/updated:
  - No component test was added for the monolithic page handler; this path is covered by typecheck/build and the existing push route tests cover the API contract.
- Validation commands run:
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add component-level tests if notification controls are extracted from the page into a smaller client component.
- Skipped ideas:
  - Did not expand notification settings or add per-event toggles.

### Increment 39: Member-Visible CSV Export

- What changed: Moved data export controls into the general settings area so every signed-in runner can download CSV runs, while JSON recovery backups remain owner-only.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - No component test was added for the monolithic page; existing export route tests cover CSV access and owner-only JSON authorization.
- Validation commands run:
  - `pnpm lint && pnpm build`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add component-level settings tests if the settings panel is extracted into smaller components.
- Skipped ideas:
  - Did not add restore/import workflow; this only makes existing exports easier to reach.

### Increment 40: Most-Consistent Challenge Timestamp Coverage

- What changed: Added regression coverage for the most-consistent challenge winner, target, completion state, and `completedAt` timestamp.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/run-metrics.test.ts`
- Tests added/updated:
  - Added one focused run-metrics test for the most-consistent weekly challenge.
- Validation commands run:
  - `pnpm test -- lib/__tests__/run-metrics.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Continue adding calculation regression tests around challenge and feed behavior before changing those flows.
- Skipped ideas:
  - Did not change challenge calculation behavior; this only documents and locks the existing behavior.

### Increment 41: README Export Permission Clarity

- What changed: Updated README export wording to clarify that JSON recovery backups are owner-only and CSV run exports are available to any signed-in runner.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `README.md`
- Tests added/updated:
  - No tests were added for documentation-only wording.
- Validation commands run:
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep README export wording in sync if restore/import support is added later.
- Skipped ideas:
  - Did not add import/restore documentation because that workflow is not implemented.

### Increment 42: Session Context Role Regression

- What changed: Added auth coverage proving current sessions hydrate from fresh store context instead of trusting stale role claims from the signed cookie.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/auth.test.ts`
- Tests added/updated:
  - Added a session-cookie test with mocked `next/headers` and store context.
- Validation commands run:
  - `pnpm test -- lib/__tests__/auth.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add cookie clear/set option tests only if session cookie behavior changes.
- Skipped ideas:
  - Did not change auth behavior; this documents the existing server-side identity boundary.

### Increment 43: Invalid Session Cookie Coverage

- What changed: Added auth coverage proving malformed session cookies return no session before loading group context.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/auth.test.ts`
- Tests added/updated:
  - Added one session-cookie test that mocks `next/headers` and confirms invalid cookies short-circuit before store context lookup.
- Validation commands run:
  - `pnpm test -- lib/__tests__/auth.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Continue adding narrow auth/session regression tests around cookie clearing and required-session failures if those paths change.
- Skipped ideas:
  - Did not change auth behavior; this increment only locks the existing invalid-cookie handling.

### Increment 44: Required Session Failure Coverage

- What changed: Added auth coverage proving `requireSession()` rejects malformed session cookies with the expected 401 auth error before loading group context.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/auth.test.ts`
- Tests added/updated:
  - Added one session guard test that asserts the user-facing sign-in error and status for invalid cookies.
- Validation commands run:
  - `pnpm test -- lib/__tests__/auth.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add cookie clearing option coverage if cookie behavior changes or route tests need it.
- Skipped ideas:
  - Did not alter auth implementation; this records the existing guard contract used by API routes.

### Increment 45: Session Cookie Option Coverage

- What changed: Added auth coverage for secure session-cookie configuration and logout cookie deletion.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/auth.test.ts`
- Tests added/updated:
  - Asserted session cookies default to non-secure for LAN HTTP, switch to secure when `RUNCOMP_SECURE_COOKIES=true`, and clear by the configured session cookie name.
- Validation commands run:
  - `pnpm test -- lib/__tests__/auth.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep cookie behavior aligned with README deployment guidance if the auth/session model changes.
- Skipped ideas:
  - Did not change session TTL or cookie persistence behavior.

### Increment 46: Export Route Store Error Coverage

- What changed: Added API route coverage proving CSV export generation failures return structured store errors to the client.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/exports-route.test.ts`
- Tests added/updated:
  - Added one `/api/exports?type=csv` failure-path test for store error status/message handling.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/exports-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add JSON backup failure-path coverage if owner backup generation gains more distinct error cases.
- Skipped ideas:
  - Did not change export route behavior; this locks the existing error handling contract.

### Increment 47: JSON Backup Error Coverage

- What changed: Added API route coverage proving owner JSON backup generation failures return structured store errors to the client.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/exports-route.test.ts`
- Tests added/updated:
  - Added one `/api/exports?type=json` owner failure-path test for store error status/message handling.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/exports-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep export route tests paired if additional export formats are added.
- Skipped ideas:
  - Did not change export route behavior; this completes the current JSON/CSV error-path coverage.

### Increment 48: Backup Push Subscription Secrecy Coverage

- What changed: Added store coverage proving owner JSON backups exclude browser push subscription endpoints and keys.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added one backup export test that saves a push subscription and verifies the backup JSON does not contain `pushSubscriptions`, endpoint text, or push key material.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep backup secrecy tests updated if recovery exports intentionally change shape.
- Skipped ideas:
  - Did not add restore/import behavior; this only strengthens backup output regression coverage.

### Increment 49: Missing-Group Export Store Coverage

- What changed: Added store coverage proving backup and CSV export helpers return the expected 404 store error for stale or missing group ids.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added one export helper regression test covering both `exportGroupBackup` and `exportRunsCsv` missing-group failures.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep route and store export error coverage aligned if export behavior changes.
- Skipped ideas:
  - Did not change export helper behavior; this documents the existing error contract.

### Increment 50: Member-Visible Settings App Status

- What changed: Added a compact Settings status row that shows RunComp version, signed-in runner, role, and group for every signed-in member.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
- Tests added/updated:
  - No component test was added for the monolithic page; this reuses an existing static settings block pattern and is covered by TypeScript/build validation.
- Validation commands run:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Extract Settings into smaller tested components if more UI-specific behavior is added.
- Skipped ideas:
  - Did not duplicate logout controls inside the new row; existing switch-group and logout buttons remain in the same group/settings panel.

### Increment 51: Login Response Sanitization Coverage

- What changed: Added store coverage proving password login returns sanitized public group/member data without credential fields.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added one store login regression test that checks the response shape and verifies `passwordHash`, `salt`, and the plaintext password are absent.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep session route tests aligned with store public data if the login response shape changes.
- Skipped ideas:
  - Did not change login behavior; this locks the existing public-data boundary.

### Increment 52: Session GET Error Handling

- What changed: Wrapped `/api/session` GET session hydration in structured error handling so store/session load failures return JSON instead of bubbling out of the route.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/session/route.ts`
  - `app/api/__tests__/session-route.test.ts`
- Tests added/updated:
  - Added one `/api/session` GET failure-path test for structured status/message responses.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/session-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Continue checking read-only API handlers for consistent structured error behavior.
- Skipped ideas:
  - Did not change successful session response shape or auth semantics.

### Increment 53: Push Key GET Error Handling

- What changed: Wrapped `/api/push` GET VAPID public-key loading in structured error handling so filesystem/key setup failures return JSON errors.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/push/route.ts`
  - `app/api/__tests__/push-route.test.ts`
- Tests added/updated:
  - Added one `/api/push` GET failure-path test for structured push key setup errors.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/push-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep notification setup UI copy aligned with the structured error returned by this route.
- Skipped ideas:
  - Did not change push subscription behavior or VAPID key generation.

### Increment 54: Group Context Sanitization Coverage

- What changed: Added store coverage proving `getGroupContext()` returns public group/member data without credential fields.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added one store regression test for sanitized group context, member run counts, and absence of password hashes, salts, and plaintext passwords.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep context sanitization coverage aligned with any future session payload changes.
- Skipped ideas:
  - Did not change context behavior; this locks the existing public-data boundary.

### Increment 55: Runner Invite Status In Settings

- What changed: Added owner-visible invite status text to each Settings runner row so owners can see whether a login link is not created, ready, or just copied.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - No component test was added for the monolithic page; this uses existing client state and is covered by TypeScript/build validation.
- Validation commands run:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Extract runner management into a small tested component if invite/status interactions grow.
- Skipped ideas:
  - Did not persist invite status; login links are signed on demand and the UI reflects the current browser session.

### Increment 56: Push Mutation Store Error Coverage

- What changed: Added route coverage proving push subscription save and removal failures return structured store errors to the client.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/push-route.test.ts`
- Tests added/updated:
  - Added `/api/push` POST and DELETE failure-path tests for store error status/message handling.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/push-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Continue pairing route coverage with store validation when push subscription behavior changes.
- Skipped ideas:
  - Did not change push mutation behavior; this locks the existing structured error contract.

### Increment 57: Runner Delete Id Validation

- What changed: Updated `/api/members` DELETE to reject missing runner ids before calling the store.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/members/route.ts`
  - `app/api/__tests__/members-route.test.ts`
- Tests added/updated:
  - Added one route test proving missing delete ids return a clear 400 and do not call `removeInactiveMember`.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/members-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Continue tightening member-management route validation before store calls.
- Skipped ideas:
  - Did not change inactive-runner removal rules; this only clarifies malformed request handling.

### Increment 58: Member Route Store Error Coverage

- What changed: Added route coverage proving member creation, edit, and removal store failures return structured errors to owners.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/members-route.test.ts`
- Tests added/updated:
  - Added `/api/members` POST, PATCH, and DELETE failure-path tests for duplicate member, duplicate rename, and active-runner removal errors.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/members-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep owner-member route tests paired with store validation as management behavior evolves.
- Skipped ideas:
  - Did not change member-management behavior; this locks the existing structured error paths.

### Increment 59: Race Goal Store Error Coverage

- What changed: Added route coverage proving owner race-goal update store failures return structured errors.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/groups-route.test.ts`
- Tests added/updated:
  - Added one `/api/groups` PATCH failure-path test for store validation of out-of-range goal miles.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/groups-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep group route tests aligned with store-level goal validation.
- Skipped ideas:
  - Did not change goal update behavior; this locks the existing structured error path.

### Increment 60: Run Route Store Error Coverage

- What changed: Added route coverage proving run list, log, reaction, and delete store failures return structured errors.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/runs-route.test.ts`
- Tests added/updated:
  - Added `/api/runs` GET, POST, PATCH, and DELETE failure-path tests for store error status/message handling.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/runs-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Continue adding focused tests around notification side effects only when behavior changes.
- Skipped ideas:
  - Did not change run route behavior; this locks existing structured error handling.

### Increment 61: Invite Token Error Coverage

- What changed: Added route coverage proving login-link token generation failures return structured errors.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/invites-route.test.ts`
- Tests added/updated:
  - Added one `/api/invites` POST failure-path test for token creation errors.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/invites-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep owner login-link UI copy aligned with invite route error messages.
- Skipped ideas:
  - Did not change invite token behavior; this locks existing structured error handling.

### Increment 62: Settings Export Safety Copy

- What changed: Added a compact note to Settings data export controls that exports omit passwords and push keys.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - No component test was added for static copy in the monolithic page; existing backup/export tests cover the sensitive-data behavior.
- Validation commands run:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Keep export UI copy aligned with backup/export behavior if restore/import is added.
- Skipped ideas:
  - Did not add restore/import or expand export formats.

### Increment 63: Challenge Notification Gating Coverage

- What changed: Added route coverage proving completed challenge notifications are sent only for freshly claimed challenge ids after logging a run.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/runs-route.test.ts`
- Tests added/updated:
  - Added one `/api/runs` POST test with a fixed system date for challenge completion claim and notification behavior.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/runs-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Add similar focused notification tests only when route notification behavior changes.
- Skipped ideas:
  - Did not change challenge calculation or notification behavior; this locks the existing duplicate-notification guard.

### Increment 64: Challenge Claim Normalization Coverage

- What changed: Added store coverage for challenge completion claim trimming, duplicate removal, blank input handling, and missing-group errors.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added one `claimChallengeCompletions` regression test for normalized ids and 404 errors.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep challenge claim tests aligned if persisted completion ids change format.
- Skipped ideas:
  - Did not change challenge claim behavior; this locks existing persistence normalization.

### Increment 65: Push Subscription Persistence Error Coverage

- What changed: Added store coverage for push subscription missing-group, missing-member, missing-list, and invalid-removal endpoint failures.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added one push subscription regression test for store-level error paths around subscribe/list/unsubscribe persistence.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep push persistence tests aligned with notification settings behavior.
- Skipped ideas:
  - Did not add per-event notification settings or change push subscription storage.

### Increment 66: Inactive Runner Removal Clarity

- What changed: Added a compact owner-facing hint in runner management rows showing whether a non-owner runner can be removed or is kept because they have run history.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - No component test was added for static row copy in the monolithic page; server-side removal rules remain covered by route and store tests.
- Validation commands run:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Extract runner management into a small tested component if more owner-row behavior is added.
- Skipped ideas:
  - Did not change removal rules; this only makes the existing inactive-only rule clearer.

### Increment 67: Runner Profile Recent Mileage Trend

- What changed: Added a tested recent-vs-prior 7-day mileage trend helper and surfaced the summary in runner profiles above the activity strip.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/run-metrics.ts`
  - `lib/__tests__/run-metrics.test.ts`
  - `app/page.tsx`
  - `app/globals.css`
- Tests added/updated:
  - Added run-metrics coverage for up, down, and flat recent mileage trend windows.
- Validation commands run:
  - `pnpm test -- lib/__tests__/run-metrics.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Extract runner profiles into a smaller tested component if profile UI behavior grows.
- Skipped ideas:
  - Did not add a chart library or redesign the profile; this keeps the existing compact modal.

### Increment 68: Empty CSV Export Header Coverage

- What changed: Added store coverage proving CSV exports for groups with no runs still include the spreadsheet header row.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added one `exportRunsCsv` regression test for empty run groups.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep CSV shape tests aligned if export columns change.
- Skipped ideas:
  - Did not change CSV behavior; this locks existing spreadsheet-friendly output.

### Increment 69: Invite Runner Id Validation

- What changed: Updated `/api/invites` to reject missing runner ids before member lookup or token creation.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/invites/route.ts`
  - `app/api/__tests__/invites-route.test.ts`
- Tests added/updated:
  - Added one route test proving missing invite runner ids return a clear 400 and do not create a token.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/invites-route.test.ts`
  - `pnpm lint`
  - `pnpm lint && pnpm test && pnpm build`
- Known follow-ups:
  - Keep owner login-link validation aligned with member management validation.
- Skipped ideas:
  - Did not change invite token semantics or expiration.

### Increment 70: Push Payload Boundary Validation

- What changed: Updated `/api/push` to reject missing subscription objects and missing endpoints before calling push subscription persistence.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/push/route.ts`
  - `app/api/__tests__/push-route.test.ts`
- Tests added/updated:
  - Added route tests for missing push subscription payloads, missing save endpoints, and missing delete endpoints.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/push-route.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Keep browser notification setup copy aligned with these clearer API errors.
- Skipped ideas:
  - Did not add push preference toggles or expand notification delivery behavior.

### Increment 71: Group Creation Context Fallback Coverage

- What changed: Added route coverage for the group creation fallback that returns the newly created owner when the fresh group context is unavailable.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/groups-route.test.ts`
- Tests added/updated:
  - Added one `/api/groups` POST test for context lookup returning `null` after group creation.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/groups-route.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Consider a clearer route-level error if session cookie setup itself fails after group creation.
- Skipped ideas:
  - Did not change group creation behavior; this increment only locks down the existing fallback.

### Increment 72: Runner Edit Blank Value Validation

- What changed: Updated `/api/members` runner edits to reject blank names and blank passwords before calling member persistence methods.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/members/route.ts`
  - `app/api/__tests__/members-route.test.ts`
- Tests added/updated:
  - Extended malformed runner edit route coverage for blank display names and blank passwords.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/members-route.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Keep owner settings form validation copy aligned with these server-side messages.
- Skipped ideas:
  - Did not change password length policy; the store still owns full password strength validation.

### Increment 73: Run Note Length Validation

- What changed: Added route-level validation for run notes over 180 characters and matched the run logging input with a `maxLength` limit.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/runs/route.ts`
  - `app/api/__tests__/runs-route.test.ts`
  - `app/page.tsx`
- Tests added/updated:
  - Extended `/api/runs` input validation coverage for oversized run notes.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/runs-route.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Consider showing a compact character counter only if real use shows note length confusion.
- Skipped ideas:
  - Did not change the store's defensive note trimming to preserve backward-compatible persistence behavior.

### Increment 74: Inactive Runner Push Cleanup Coverage

- What changed: Added store coverage proving inactive runner removal also removes that runner's saved push subscription.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Extended the inactive runner removal store test to create and verify cleanup of a saved push subscription.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Keep removal behavior limited to inactive runners until a deliberate deactivate/archive model exists.
- Skipped ideas:
  - Did not add a broader member archival model; this only strengthens existing cleanup guarantees.

### Increment 75: Cross-Realm JSON Parse Error Handling

- What changed: Added shared malformed JSON error detection and switched mutable API routes to use it so bad JSON returns a clear 400 instead of a generic 500.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/route-utils.ts`
  - `app/api/groups/route.ts`
  - `app/api/invites/route.ts`
  - `app/api/members/route.ts`
  - `app/api/push/route.ts`
  - `app/api/runs/route.ts`
  - `app/api/session/route.ts`
  - `app/api/__tests__/invites-route.test.ts`
- Tests added/updated:
  - Added invite route coverage proving malformed JSON is rejected before token creation.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/invites-route.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Add malformed JSON coverage to other mutable route suites as those files are touched.
- Skipped ideas:
  - Did not introduce a route parsing abstraction; the shared predicate keeps this small and compatible with existing route structure.

### Increment 76: Mutable Route Malformed JSON Coverage

- What changed: Added a shared malformed JSON request test helper and expanded bad-JSON coverage across group, session, member, push, run, and invite route suites.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/__tests__/route-test-utils.ts`
  - `app/api/__tests__/groups-route.test.ts`
  - `app/api/__tests__/session-route.test.ts`
  - `app/api/__tests__/members-route.test.ts`
  - `app/api/__tests__/push-route.test.ts`
  - `app/api/__tests__/runs-route.test.ts`
  - `app/api/__tests__/invites-route.test.ts`
- Tests added/updated:
  - Added malformed JSON coverage for group creation, race goal updates, session login, member create/edit, push subscribe/unsubscribe, run create/reaction, and invite creation.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/groups-route.test.ts app/api/__tests__/session-route.test.ts app/api/__tests__/push-route.test.ts app/api/__tests__/runs-route.test.ts app/api/__tests__/members-route.test.ts app/api/__tests__/invites-route.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Keep new mutable routes on the same JSON body error behavior.
- Skipped ideas:
  - Did not add an endpoint-level parser abstraction; current routes are still small enough for explicit guards.

### Increment 77: Non-Blocking Export History Writes

- What changed: Made export history timestamp writes best-effort so localStorage failures cannot block JSON backup or CSV download navigation.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/export-history.ts`
  - `lib/__tests__/export-history.test.ts`
- Tests added/updated:
  - Added export history coverage for storage write failures.
- Validation commands run:
  - `pnpm test -- lib/__tests__/export-history.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Consider surfacing export start feedback in Settings if download navigation is delayed by the browser.
- Skipped ideas:
  - Did not add a server-side export audit log; local-only history remains enough for this private deployment.

### Increment 78: Missing Runner Export Fallback Coverage

- What changed: Added store coverage proving JSON backups and CSV exports remain readable when persisted run data references a missing runner.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `lib/__tests__/store.test.ts`
- Tests added/updated:
  - Added one file-backed export regression test that edits persisted data to remove the runner for an existing run and verifies `Unknown` fallback output.
- Validation commands run:
  - `pnpm test -- lib/__tests__/store.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Keep export paths tolerant of old or imperfect file-backed data.
- Skipped ideas:
  - Did not introduce repair or import tooling; this only protects current export readability.

### Increment 79: Export Filename Sanitization

- What changed: Sanitized export attachment filename group-code segments so hand-edited or legacy group codes cannot produce awkward `Content-Disposition` filenames.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/exports/route.ts`
  - `app/api/__tests__/exports-route.test.ts`
- Tests added/updated:
  - Added route coverage for unsafe group-code characters in CSV export filenames.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/exports-route.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Reuse the filename segment helper if future download endpoints are added.
- Skipped ideas:
  - Did not change normal generated group codes or exported file contents.

### Increment 80: Blank Invite Token Login Fallback

- What changed: Updated `/api/session` to ignore blank invite token strings and continue with normal group-code/password login.
- Files touched:
  - `GOAL.md`
  - `AGENT_PROGRESS.md`
  - `app/api/session/route.ts`
  - `app/api/__tests__/session-route.test.ts`
- Tests added/updated:
  - Added session route coverage for blank invite tokens falling back to password login without verifying an invite token.
- Validation commands run:
  - `pnpm test -- app/api/__tests__/session-route.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Known follow-ups:
  - Keep login-mode detection tolerant of empty URL params from shared links.
- Skipped ideas:
  - Did not change nonblank invite-token behavior or invite validation rules.
