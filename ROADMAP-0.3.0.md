# RunComp 0.3.0 Plan

## Theme

Make RunComp feel alive between runs.

0.2.0 made the app feel more native and playful. 0.3.0 should focus on the engagement loop: reasons to open the app, react, compete, and keep the family race moving without turning the release into an admin or data-management project.

## Release Shape

0.3.0 is the engagement loop release.

The work should make the family race feel active through lightweight challenges, richer feed moments, a stronger weekly recap, and event-driven notifications. Avoid scheduled background jobs, complex persistence, and owner-management workflows unless they are directly needed to support the engagement loop.

## Goals

### 1. Lightweight Challenges

Add short-term family goals inside the larger race.

- Weekly family mileage challenge.
- Weekend participation challenge.
- Beat last week's family total.
- Everyone logs at least one run.
- Most consistent runner of the week.
- Challenge progress card on Home.
- Challenge events in Feed.
- Challenge-complete notifications.

Implementation notes:

- Prefer computed challenges derived from existing runs and members.
- Persist only what is needed to avoid duplicate completion events or notifications.
- Keep challenge definitions simple enough to test in `lib/run-metrics.ts`.

### 2. Feed Moments

Make the Feed more than a raw run list.

- Runs.
- Achievements.
- Challenge progress.
- Challenge completed.
- Lead changes.
- Close-call comeback events.
- Weekly recap posted.
- Reactions on feed moments, not only runs, if this can be done without a large store redesign.

Implementation notes:

- Extend the existing feed-event model before introducing a new event table.
- If durable feed events become necessary, keep the schema narrow and local-first.

### 3. Weekly Recap Screen

Promote the weekly recap from a panel into a full native-feeling screen.

- Family headline.
- Total miles and runs.
- Top runner.
- Biggest run.
- Most improved.
- Best streak.
- Crowd favorite.
- Challenge winners.
- Feed-style recap moments.

Later:

- Shareable recap image.

### 4. Event-Driven Notifications

Make push notifications useful without adding scheduler infrastructure.

- Notify when someone logs a run.
- Notify on lead changes.
- Notify when someone is close to passing another runner.
- Notify when a family challenge is completed.
- Avoid noisy duplicate notifications.

Explicitly defer:

- Weekly recap-ready push notifications.
- Weekend nudges when nobody has logged.
- Any notification that requires cron, background jobs, or server-side scheduling.

### 5. Runner Profile Preview

Add the smallest profile improvement that makes runner cards feel deeper.

- Tap a runner to open a profile-style view or modal.
- Show personal records:
  - Longest run.
  - Fastest pace.
  - Biggest week.
  - Best streak.
- Show achievement shelf.
- Show recent trend if the existing metrics make this straightforward.

Defer:

- Head-to-head stats against every family member.
- Larger card rarity/title redesigns.

## 0.3.0 Acceptance Criteria

- Home shows active challenge progress.
- Feed includes non-run moments for challenge and race events.
- Weekly recap has a dedicated screen or full-screen native-feeling view.
- Push notifications cover run logged, lead change, and challenge completion.
- Duplicate challenge completion notifications are guarded.
- Existing run logging, reactions, recap metrics, and push subscription tests still pass.
- New challenge and feed-event calculations have focused tests.

## Defer For Later

- Owner/admin polish.
- Backup and export.
- Real Settings screen.
- Scheduled nudges and scheduled recap notifications.
- Full runner profile system.
- GPS tracking.
- Background run recording.
- Route tracking.
- Public sharing.
- Complex privacy controls.
- Full social feed.

These can add a lot of complexity without improving the core 0.3.0 engagement loop.
