# Data model & fingerprinting

One MongoDB database, five collections. The design goal, in one line: **reads hit small, counted collections; writes are a fixed number of index-backed operations per event.**

## Collections

### `apps` — registered applications
```js
{ _id, name, package_name /*unique*/, api_key /*unique*/, created_at, updated_at }
```

### `issues` — one document per distinct bug (the grouping target)
```js
{
  _id, app_id, fingerprint,            // unique per (app_id, fingerprint)
  exception_type, sample_message, location,   // e.g. "MainActivity#onClick"
  is_fatal, status,                    // open | resolved | ignored
  event_count, user_count,             // atomic counters
  first_seen, last_seen,               // $min / $max
  last_event: { app_version, os_version, device_model, raw_stack_trace }
}
```

### `events` — individual occurrences (source of truth for analytics)
```js
{
  _id, app_id, issue_id, fingerprint, install_id,
  timestamp,        // crash time (client clock, clamped to server time)
  received_at,      // server time
  is_fatal, app_version, version_code, os_version, sdk_int,
  device_manufacturer, device_model, thread,
  exception: { type, message, frames: [{cls, method, file, line}], cause },
  raw_stack_trace,  // capped 16 KB
  breadcrumbs,      // capped 30
  custom            // capped 20 keys
}
```

### `issue_users` — distinct-user bookkeeping
```js
{ issue_id, install_id /* unique pair */, first_seen }
```

### `sessions` — launch pings (crash-free denominator)
```js
{ _id, app_id, install_id, received_at, app_version, version_code,
  os_version, sdk_int, device_manufacturer, device_model }
```

## The ingest write path — exactly 3 writes per report

1. **Atomic issue upsert** on `(app_id, fingerprint)`:
   `$setOnInsert` identity fields · `$inc event_count` · `$min first_seen` · `$max last_seen` · `$set last_event`
2. **Event insert** (the raw occurrence).
3. **`issue_users` upsert** — if it inserted a new pair, `$inc user_count`.

Distinct users therefore cost O(1) per event with no unbounded arrays on the issue document, and the issues table costs one indexed query regardless of event volume.

## Fingerprinting — one bug = one issue

Computed **server-side** (`api/services/fingerprint.py`), so grouping can improve without shipping a new SDK:

```
root   = deepest exception in the cause chain
frames = first 5 stack frames whose class starts with the app's package
         (fallback: first 3 frames overall if none are in-app)

fingerprint = SHA-256( package_name | root.type | class#method | class#method | … )
```

Deliberately **excluded** from the hash:

| Excluded | Why |
|---|---|
| Exception **message** | varies per occurrence — "index 5 out of bounds" vs "index 7" is the same bug |
| **Line numbers** | any edit above the bug would shift them and split one bug into two issues |
| **App version** | the same bug across versions is one issue — with a per-version breakdown instead |
| Framework frames (when in-app frames exist) | `android.*`/`java.*` frames describe the symptom, not the location of the bug |

The **root cause** wins over wrapper exceptions: `RuntimeException("upload failed", IOException(...))` groups by the `IOException` — rewrapping doesn't create new issues.

Known trade-off (accepted and documented): two genuinely different bugs that throw the same exception type from the same method would share an issue. In practice this is rare, and the alternative — splitting one bug into many issues — is far more damaging to triage.

The recipe is covered by 8 unit tests (`api/tests/test_fingerprint.py`).

## Analytics

Charts and breakdowns are **aggregation pipelines over `events`** (`$match → $group → $sort`), windowed by crash time:

- timeseries: `$dateToString` day buckets, zero-filled server-side, fatal counted via `$cond`
- breakdowns: `$group` by version/OS/device with `$addToSet install_id` for per-bucket users
- crash-free users (30 d): `1 − |distinct users with a fatal event| / |distinct users with a session|`

## Indexes

```
apps:         {package_name}!, {api_key}!
issues:       {app_id, fingerprint}!, {app_id, last_seen}, {app_id, status, event_count}
events:       {issue_id, timestamp}, {app_id, timestamp}, {app_id, received_at}, {app_id, app_version}
issue_users:  {issue_id, install_id}!
sessions:     {app_id, received_at}
```
(`!` = unique.) Created idempotently at startup (`api/services/db_indexes.py`).

## Storage efficiency

- Grouping means the portal's hot path reads **issues** (hundreds of docs), never scans events.
- Ingest caps: 16 KB stack trace, 30 breadcrumbs, 20 custom keys, batches ≤ 20.
- SDK-side cap: at most `maxPendingReports` (default 50) files queued on the device.
- Retention (future work): a TTL index on `events.received_at` / `sessions.received_at` would expire raw data while issues and their counters survive.
