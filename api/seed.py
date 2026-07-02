"""Seed the database with realistic fake crash data for portal development and demos.

Usage:  .venv/bin/python seed.py [--events 300]

Creates (idempotently) a demo app matching the Android demo application's package name,
then generates crash events spread over the last 30 days across a handful of distinct
"bugs", versions, devices and users — all through the same ingest path the API uses,
so grouping/counters behave exactly like production traffic.
"""
import argparse
import random
import uuid
from datetime import datetime, timedelta, timezone

from mongodb_connection_holder import MongoConnectionHolder
from services.db_indexes import ensure_indexes
from services.ingest import process_report

DEMO_APP = {
    'name': 'CrashMonitor Demo',
    'package_name': 'com.benalaf.crashmonitor.demo',
}

APP_VERSIONS = ['1.0.0', '1.1.0', '1.2.0']
DEVICES = [
    ('Samsung', 'SM-G991B', '14', 34),
    ('Google', 'Pixel 8', '15', 35),
    ('Xiaomi', 'M2101K6G', '13', 33),
    ('Samsung', 'SM-A536B', '14', 34),
    ('OnePlus', 'CPH2409', '14', 34),
]

BUGS = [
    {
        'type': 'java.lang.NullPointerException',
        'message': "Attempt to invoke virtual method 'java.lang.String com.benalaf.crashmonitor.demo.User.getName()' on a null object reference",
        'frames': [
            {'cls': 'com.benalaf.crashmonitor.demo.ProfileActivity', 'method': 'renderUser', 'file': 'ProfileActivity.kt', 'line': 61},
            {'cls': 'com.benalaf.crashmonitor.demo.ProfileActivity', 'method': 'onCreate', 'file': 'ProfileActivity.kt', 'line': 24},
        ],
        'is_fatal': True,
    },
    {
        'type': 'java.lang.IndexOutOfBoundsException',
        'message': 'Index: {i}, Size: 3',
        'frames': [
            {'cls': 'com.benalaf.crashmonitor.demo.CartAdapter', 'method': 'getItem', 'file': 'CartAdapter.kt', 'line': 33},
            {'cls': 'com.benalaf.crashmonitor.demo.CartActivity', 'method': 'onItemClick', 'file': 'CartActivity.kt', 'line': 88},
        ],
        'is_fatal': True,
    },
    {
        'type': 'java.lang.IllegalStateException',
        'message': 'Fragment CheckoutFragment not attached to an activity',
        'frames': [
            {'cls': 'com.benalaf.crashmonitor.demo.CheckoutFragment', 'method': 'requireActivity', 'file': 'CheckoutFragment.kt', 'line': 112},
        ],
        'is_fatal': True,
    },
    {
        'type': 'java.io.IOException',
        'message': 'Unable to resolve host "api.example.com"',
        'frames': [
            {'cls': 'com.benalaf.crashmonitor.demo.SyncService', 'method': 'pull', 'file': 'SyncService.kt', 'line': 45},
        ],
        'is_fatal': False,
    },
    {
        'type': 'android.database.sqlite.SQLiteFullException',
        'message': 'database or disk is full (code 13)',
        'frames': [
            {'cls': 'com.benalaf.crashmonitor.demo.LocalCache', 'method': 'write', 'file': 'LocalCache.kt', 'line': 71},
        ],
        'is_fatal': True,
    },
]


def get_or_create_app(db):
    existing = db['apps'].find_one({'package_name': DEMO_APP['package_name']})
    if existing:
        print(f"Using existing app {existing['_id']} ({existing['package_name']})")
        return existing

    now = datetime.now(timezone.utc)
    app_doc = {
        '_id': str(uuid.uuid4()),
        'name': DEMO_APP['name'],
        'package_name': DEMO_APP['package_name'],
        'api_key': str(uuid.uuid4()),
        'created_at': now,
        'updated_at': now,
    }
    db['apps'].insert_one(app_doc)
    print(f"Created app {app_doc['_id']} — API key: {app_doc['api_key']}")
    return app_doc


def fake_report(install_ids):
    bug = random.choices(BUGS, weights=[5, 3, 2, 4, 1])[0]
    manufacturer, model, os_version, sdk_int = random.choice(DEVICES)
    days_back = random.betavariate(1.2, 3.0) * 30  # skew towards recent days
    ts = datetime.now(timezone.utc) - timedelta(days=days_back, minutes=random.randint(0, 1440))

    return {
        'install_id': random.choice(install_ids),
        'timestamp': ts.isoformat(),
        'is_fatal': bug['is_fatal'],
        'app': {
            'package_name': DEMO_APP['package_name'],
            'version_name': random.choices(APP_VERSIONS, weights=[1, 3, 6])[0],
            'version_code': 1,
        },
        'device': {
            'manufacturer': manufacturer,
            'model': model,
            'os_version': os_version,
            'sdk_int': sdk_int,
        },
        'thread': 'main' if bug['is_fatal'] else 'worker-1',
        'exception': {
            'type': bug['type'],
            'message': bug['message'].replace('{i}', str(random.randint(3, 40))),
            'frames': bug['frames'],
            'cause': None,
        },
        'raw_stack_trace': f"{bug['type']}: {bug['message']}\n" + '\n'.join(
            f"\tat {f['cls']}.{f['method']}({f['file']}:{f['line']})" for f in bug['frames']
        ),
        'breadcrumbs': [],
        'custom': {},
    }


def fake_sessions(db, app_doc, install_ids, count):
    """Direct inserts — sessions have no grouping logic, so no ingest path needed."""
    docs = []
    for _ in range(count):
        manufacturer, model, os_version, sdk_int = random.choice(DEVICES)
        days_back = random.betavariate(1.2, 3.0) * 30
        ts = datetime.now(timezone.utc) - timedelta(days=days_back, minutes=random.randint(0, 1440))
        docs.append({
            '_id': str(uuid.uuid4()),
            'app_id': app_doc['_id'],
            'install_id': random.choice(install_ids),
            'received_at': ts,
            'app_version': random.choices(APP_VERSIONS, weights=[1, 3, 6])[0],
            'version_code': 1,
            'os_version': os_version,
            'sdk_int': sdk_int,
            'device_manufacturer': manufacturer,
            'device_model': model,
        })
    db['sessions'].insert_many(docs)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--events', type=int, default=300)
    parser.add_argument('--sessions', type=int, default=1200)
    args = parser.parse_args()

    db = MongoConnectionHolder.get_db()
    if db is None:
        raise SystemExit('Could not connect to the database — check api/.env')
    ensure_indexes(db)

    app_doc = get_or_create_app(db)
    install_ids = [str(uuid.uuid4()) for _ in range(40)]

    for i in range(args.events):
        process_report(db, app_doc, fake_report(install_ids))
        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{args.events} events ingested")

    # sessions come from a wider population: users who actually crashed (from the
    # events collection, so this also works on a sessions-only rerun) PLUS healthy
    # ones — the crash-free-users percentage needs a real denominator
    crash_users = db['events'].distinct('install_id', {'app_id': app_doc['_id']}) or install_ids
    session_population = list(crash_users) + [str(uuid.uuid4()) for _ in range(150)]
    fake_sessions(db, app_doc, session_population, args.sessions)
    print(f"  {args.sessions} sessions inserted ({len(session_population)} user pool)")

    issues = list(db['issues'].find({'app_id': app_doc['_id']}))
    print(f"\nDone: {args.events} events across {len(issues)} issues:")
    for issue in issues:
        print(f"  [{issue['status']:8}] {issue['exception_type']} @ {issue['location']}"
              f" — events={issue['event_count']} users={issue['user_count']}")


if __name__ == '__main__':
    main()
