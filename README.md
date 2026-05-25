# RunComp

RunComp is a small running competition app for testing Hostlet on a homelab. It started as Shane vs Molly, but supports private groups with more runners.

## Features

- Log miles for each signed-in group member
- Create a private run group with a group code
- Sign in with a group code, member name, and password
- Group owners can create member passwords for other runners
- Group owners can copy invite links that prefill only the group code
- Track all-time, weekly, and monthly totals for every member
- Compare current leader and gap
- View streaks, averages, longest runs, recent runs, and a 14-day chart
- Track weekly family challenges and challenge-complete feed moments
- View a dedicated weekly recap with highlights, challenge status, and recap moments
- Open runner profiles with personal records, recent trends, and achievement shelves
- Enable push alerts for runs, lead changes, close-call passes, and completed challenges
- File-backed persistence through `DATA_DIR`

## Local Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Hostlet Notes

Use these settings when creating the Hostlet app:

- Install command: `pnpm install`
- Build command: `pnpm build`
- Start command: `pnpm start`
- Container port: `3000`
- Health path: `/`

Set `DATA_DIR` to a mounted persistent path if you want groups, passwords, sessions, and logged miles to survive container replacement. Without it, RunComp writes to `.data/runcomp.json` inside the app container.

Set `RUNCOMP_SECRET` to a long random value if you want login sessions to survive container replacement. If you serve the app only over HTTPS, set `RUNCOMP_SECURE_COOKIES=true`; leave it false for plain LAN HTTP.

Push alerts use generated VAPID keys stored in `DATA_DIR` by default. For production, you can set `VAPID_SUBJECT` to a contact URI like `mailto:you@example.com` or `https://your-runcomp-host.example.com`; iOS rejects local-only subjects.

Invite links are built from the current browser URL with `?group=<group-code>`, so they work from LAN addresses, Hostlet routes, and tunnel domains without hard-coded host settings.
