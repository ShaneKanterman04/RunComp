# RunComp 0.3.1 Plan

## Theme

Make RunComp easier to own, maintain, and recover.

0.3.0 should make the race feel more alive. 0.3.1 should clean up the operational side: owner controls, settings, backup/export, and the setup paths that matter for a small family or homelab app.

## Release Shape

0.3.1 is the owner and data polish release.

The work should make group management safer and more obvious without expanding into a general social platform. Keep the implementation local-first and file-backed unless a feature clearly requires more.

## Goals

### 1. Owner And Setup Polish

Make the group owner flow easier for family use.

- Invite status for each runner.
- Copy login link per runner.
- Reset runner password.
- Edit runner display name.
- Remove inactive runner.
- Clearer owner-only controls.
- Better first-run setup flow.

Implementation notes:

- Keep owner-only checks enforced in API routes and store functions.
- Prefer explicit store methods for member edits instead of mutating group state from routes.
- Decide how removing a runner affects historical runs before implementation.

### 2. Real Settings Screen

Move scattered group controls into one native-feeling Settings area.

- Race goal.
- Notification status.
- Runner management.
- Backup/export.
- Install/PWA status.
- App version.
- Logout and switch group.

Implementation notes:

- Keep Settings task-oriented and compact.
- Avoid turning Settings into a landing page or help screen.
- Preserve fast access to core race views on mobile.

### 3. Backup And Export

Since this is homelab and family data, make it easy to keep a copy.

- Download JSON backup.
- Download CSV runs export.
- Show last backup timestamp if it can be tracked cleanly.
- Keep implementation simple and local-first.

Later:

- Basic import/restore.
- Backup validation preview.

Implementation notes:

- JSON backup should be suitable for recovery by an owner.
- CSV export should be human-readable and spreadsheet-friendly.
- Avoid exposing password hashes or secrets in user-facing exports unless the file is explicitly a full backup.

### 4. Runner Profiles Follow-Up

Finish the profile work that was intentionally kept small in 0.3.0.

- Show head-to-head stats against each family member.
- Show runner title and card rarity more prominently.
- Add richer recent run trends.
- Improve profile empty states for new runners.

### 5. Notification Settings

Give users clearer control over notification behavior.

- Show current push subscription status.
- Explain blocked or unsupported notification states.
- Let users disable notifications for the current device.
- Consider per-event toggles only if the existing push model can support them cleanly.

## 0.3.1 Acceptance Criteria

- Owners can manage runner names, passwords, and inactive members from a clear UI.
- Settings provides a single place for group controls, notification status, backup/export, app version, and logout.
- Owners can download a JSON backup.
- Users can download a CSV runs export.
- Member-management behavior is covered by store and route tests.
- Backup/export output has focused tests for shape and sensitive-data handling.

## Defer For Later

- Scheduled server jobs.
- Automatic cloud backups.
- Multi-owner roles.
- Granular privacy permissions.
- Public sharing.
- Route tracking.
- Full import/restore workflow.

These are useful directions, but they are not needed to make the app easier to own and maintain in 0.3.1.
