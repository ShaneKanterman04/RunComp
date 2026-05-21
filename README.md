# RunComp

RunComp is a small Shane vs Molly running competition app for testing Hostlet on a homelab.

## Features

- Log miles for Shane or Molly
- Track all-time, weekly, and monthly totals
- Compare current leader and gap
- View streaks, averages, longest runs, recent runs, and a 14-day chart
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

Set `DATA_DIR` to a mounted persistent path if you want logged miles to survive container replacement. Without it, RunComp writes to `.data/runs.json` inside the app container.
