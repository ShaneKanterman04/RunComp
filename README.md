# RunComp

RunComp is a small running competition app for testing Hostlet on a homelab. It started as Shane vs Molly, but supports private groups with more runners.

## Features

- Log miles for each signed-in group member
- Create a private run group with a group code
- Sign in with a group code, member name, and password
- Group owners can create member passwords for other runners
- Group owners can edit runner names, reset passwords, and remove inactive runners
- Group owners can copy invite links that prefill the group code or sign in a specific runner with an expiring login link
- Track all-time, weekly, and monthly totals for every member
- Compare current leader and gap
- View streaks, averages, longest runs, recent runs, and a 14-day chart
- Track weekly family challenges and challenge-complete feed moments
- View a dedicated weekly recap with highlights, challenge status, and recap moments
- Open runner profiles with personal records, recent trends, and achievement shelves
- Enable push alerts for runs, lead changes, close-call passes, and completed challenges
- Download owner JSON backups and spreadsheet-friendly CSV run exports for any signed-in runner
- File-backed persistence through `DATA_DIR`

## Local Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Before considering a local change ready, run the same validation gate used by the project:

```bash
pnpm lint
pnpm test
pnpm build
```

## Hostlet Notes

Use these settings when creating the Hostlet app:

- Install command: `pnpm install`
- Build command: `pnpm build`
- Start command: `pnpm start`
- Container port: `3000`
- Health path: `/`

Set `DATA_DIR` to a mounted persistent path if you want groups, passwords, sessions, and logged miles to survive container replacement. Without it, RunComp writes to `.data/runcomp.json` inside the app container.

Set `RUNCOMP_SECRET` to a long random value if you want login sessions to survive container replacement. If you serve the app only over HTTPS, set `RUNCOMP_SECURE_COOKIES=true`; leave it false for plain LAN HTTP.

Push alerts use generated VAPID keys stored in `DATA_DIR` by default. For production, you can set `VAPID_SUBJECT` to a contact URI like `mailto:you@example.com` or `https://your-runcomp-host.example.com`; iOS rejects local-only subjects. You can also provide both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` if you want to manage keys outside the data directory.

Invite links are built from the current browser URL with `?group=<group-code>`, so they work from LAN addresses, Hostlet routes, and tunnel domains without hard-coded host settings.

## Configuration

RunComp is local-first and file-backed. The useful environment variables are:

- `DATA_DIR`: Directory for `runcomp.json`, generated session secret, and generated VAPID keys. Defaults to `.data` in the app directory.
- `RUNCOMP_SECRET`: Optional long secret for signing login sessions and invite links. If omitted, RunComp creates one in `DATA_DIR`.
- `RUNCOMP_SECURE_COOKIES`: Set to `true` only when serving over HTTPS.
- `VAPID_SUBJECT`: Contact subject for push services, usually `mailto:you@example.com` or the public HTTPS app URL.
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: Optional static push keys. If omitted, RunComp generates and stores keys in `DATA_DIR`.
- `NEXT_PUBLIC_APP_URL` or `PUBLIC_APP_URL`: Optional public app URL used to derive a push subject when `VAPID_SUBJECT` is not set.
- `PORT`: Port used by `pnpm start`; defaults to `3000`.
- `ALLOWED_DEV_ORIGINS`: Optional comma-separated extra origins for Next.js dev-server access from LAN or tunnel hosts.

Owner JSON backups are sanitized for normal app recovery use and do not include password hashes, salts, session secrets, or VAPID keys. Any signed-in runner can download CSV run exports for spreadsheets; CSV cells from runner names or notes are neutralized when they look like formulas.
