# CrashMonitor SDK

Crash & error monitoring for Android — a mini-Sentry built from three parts:

- **Android SDK** (`crashmonitor`) — catches uncaught exceptions, persists them to disk before the process dies, and uploads them on the next launch.
- **Backend API** (Flask + MongoDB Atlas, deployed on Vercel) — ingests reports and groups identical crashes into issues via fingerprinting.
- **Admin portal** — shows which bugs hit how many users, on which app versions and devices.

> Documentation is under construction — pages below land as the corresponding components ship.

## Contents

- Getting started (SDK integration in 5 minutes) — *coming with the library*
- Library reference — *coming with the library*
- API reference — *coming with the API*
- Data model & fingerprinting — *coming with the API*
- Portal guide — *coming with the portal*
