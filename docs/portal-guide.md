# Portal guide

The admin portal lives at **[/portal](https://crash-monitoring-sdk.vercel.app/portal/)**, served by the same Flask deployment as the API. It's a single-page app (vanilla JS + Chart.js) that talks to the admin endpoints with the `X-Admin-Key` header. It follows your system's light/dark theme.

## Signing in

Enter the **admin key** (the `ADMIN_KEY` the server was deployed with). The key is kept in your browser's localStorage; any expired/invalid key drops you back to the login screen.

> Authorization model: the admin key sees and manages everything; per-app **API keys** (used by the SDK) can only ingest data for their own app.

## Apps

![Dashboard](assets/portal-dashboard.png)

The landing page lists every registered application with its issue/event counts.

- **＋ New app** — enter a display name and the Android **package name** (must equal the app's `applicationId`). The generated **API key is revealed once** — copy it into `CrashMonitorConfig.Builder(…)`. Lost keys can be regenerated via the API (`PUT /api/v1/apps/{id}` with `regenerate_api_key`).
- **Delete** removes the app **and all of its data** (issues, events, users, sessions) — irreversibly.

## App dashboard

The dashboard answers "how healthy is this app?" at a glance:

- **KPI tiles** — crash-free users % (last 30 days, from session pings), total events (with fatal count), open issues, affected users, and last-24 h activity.
- **Crashes per day** — stacked daily columns, fatal vs non-fatal, over the selected range (7/30/90 days).
- **Breakdown** — events and affected users grouped by **app version**, **OS version**, or **device model** (selector in the filter row). This is where "the bug only hits Android 14 on Samsung" becomes visible.
- **Issues table** — one row per distinct bug: type & location, crash/handled chip, events, users, status chip, last seen. Sortable by clicking the Events / Users / Last-seen headers; filterable by status.

## Issue page

![Issue detail](assets/portal-issue.png)

Click any issue row to open it:

- **Header** — exception type @ location, the sample message, event/user counts, first/last seen.
- **Actions** — *Mark resolved*, *Ignore*, *Reopen*, and *Delete issue* (removes its events too). Resolved/ignored issues keep counting if they re-occur — reopen them to re-triage.
- **Charts** — this issue's occurrences per day, and which app versions it hits.
- **Stack trace** — the latest occurrence's full trace, monospaced and scrollable.
- **Occurrences** — the individual events (time, app version, device, OS, thread, short install id), paged.

## Typical triage loop

1. Open the dashboard → sort issues by **Users** (blast radius beats raw event count).
2. Open the worst issue → read the stack trace → check the **By app version** chart: does it only hit the new release?
3. Fix the bug, ship a release, **Mark resolved**.
4. If it comes back in the new version, the issue's counters keep rising — reopen and dig again.
5. Noise (third-party bugs you can't fix) → **Ignore** keeps the table clean without deleting evidence.

## Demo data

`api/seed.py` generates a realistic dataset (5 distinct bugs, ~300 events over 30 days, 1,200 sessions) so the portal can be evaluated without integrating a real app first:

```bash
cd api && ./.venv/bin/python seed.py
```
