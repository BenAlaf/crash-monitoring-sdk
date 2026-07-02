"""Shared crash-report ingestion logic (used by the crashes controller and seed.py).

Write path per report — fixed 3 writes, all index-backed (IMPLEMENTATION_PLAN.md §3):
  1. atomic upsert of the issue (grouping by fingerprint) with $inc/$min/$max counters
  2. insert of the raw event
  3. dedup upsert into issue_users; user_count is only incremented on first sighting
"""
import uuid
from datetime import datetime, timezone

from pymongo import ReturnDocument

from services.fingerprint import compute_fingerprint, issue_display_fields

MAX_BATCH = 20
MAX_STACK_TRACE_BYTES = 16 * 1024
MAX_BREADCRUMBS = 30
MAX_CUSTOM_KEYS = 20

REQUIRED_TOP_LEVEL = ('install_id', 'timestamp', 'app', 'exception')


class InvalidReport(ValueError):
    """Raised when a submitted crash report fails validation."""


def _parse_timestamp(value, received_at):
    try:
        ts = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        raise InvalidReport(f"invalid timestamp: {value!r} (expected ISO-8601)")
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    # client clocks can be wrong — never accept a crash "from the future"
    return min(ts, received_at)


def validate_report(report):
    if not isinstance(report, dict):
        raise InvalidReport('report must be a JSON object')

    missing = [key for key in REQUIRED_TOP_LEVEL if key not in report]
    if missing:
        raise InvalidReport(f"missing required fields: {', '.join(missing)}")

    app_info = report['app']
    if not isinstance(app_info, dict) or not app_info.get('package_name') or not app_info.get('version_name'):
        raise InvalidReport('app must contain package_name and version_name')

    exception = report['exception']
    if not isinstance(exception, dict) or not exception.get('type'):
        raise InvalidReport('exception must contain a type')
    if not isinstance(exception.get('frames'), list):
        raise InvalidReport('exception must contain a frames array')


def process_report(db, app_doc, report):
    """Validate, group and store one crash report. Returns the response item."""
    validate_report(report)

    package_name = report['app']['package_name']
    if package_name != app_doc['package_name']:
        raise InvalidReport(
            f"package_name {package_name!r} does not match the app registered for this API key"
        )

    received_at = datetime.now(timezone.utc)
    timestamp = _parse_timestamp(report['timestamp'], received_at)
    is_fatal = bool(report.get('is_fatal', True))
    exception = report['exception']
    device = report.get('device') or {}
    fingerprint = compute_fingerprint(package_name, exception)

    app_id = app_doc['_id']
    now = datetime.now(timezone.utc)

    last_event_snapshot = {
        'app_version': report['app'].get('version_name'),
        'os_version': device.get('os_version'),
        'device_model': device.get('model'),
        'raw_stack_trace': (report.get('raw_stack_trace') or '')[:MAX_STACK_TRACE_BYTES],
    }

    # 1. atomic issue upsert — one document per (app, fingerprint)
    issue = db['issues'].find_one_and_update(
        {'app_id': app_id, 'fingerprint': fingerprint},
        {
            '$setOnInsert': {
                '_id': str(uuid.uuid4()),
                'is_fatal': is_fatal,
                'status': 'open',
                'created_at': now,
                'user_count': 0,
                **issue_display_fields(package_name, exception),
            },
            '$inc': {'event_count': 1},
            '$min': {'first_seen': timestamp},
            '$max': {'last_seen': timestamp},
            '$set': {'updated_at': now, 'last_event': last_event_snapshot},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    # 2. raw event insert
    event = {
        '_id': str(uuid.uuid4()),
        'app_id': app_id,
        'issue_id': issue['_id'],
        'fingerprint': fingerprint,
        'install_id': str(report['install_id']),
        'timestamp': timestamp,
        'received_at': received_at,
        'is_fatal': is_fatal,
        'app_version': report['app'].get('version_name'),
        'version_code': report['app'].get('version_code'),
        'os_version': device.get('os_version'),
        'sdk_int': device.get('sdk_int'),
        'device_manufacturer': device.get('manufacturer'),
        'device_model': device.get('model'),
        'thread': report.get('thread'),
        'exception': exception,
        'raw_stack_trace': (report.get('raw_stack_trace') or '')[:MAX_STACK_TRACE_BYTES],
        'breadcrumbs': (report.get('breadcrumbs') or [])[:MAX_BREADCRUMBS],
        'custom': dict(list((report.get('custom') or {}).items())[:MAX_CUSTOM_KEYS]),
    }
    db['events'].insert_one(event)

    # 3. distinct-user bookkeeping without unbounded arrays
    dedup = db['issue_users'].update_one(
        {'issue_id': issue['_id'], 'install_id': event['install_id']},
        {'$setOnInsert': {'first_seen': timestamp}},
        upsert=True,
    )
    if dedup.upserted_id is not None:
        db['issues'].update_one({'_id': issue['_id']}, {'$inc': {'user_count': 1}})

    return {
        'event_id': event['_id'],
        'issue_id': issue['_id'],
        'fingerprint': fingerprint,
    }
