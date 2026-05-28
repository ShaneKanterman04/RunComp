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
