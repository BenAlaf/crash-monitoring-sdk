"""Idempotent index creation, run once at startup (create_index is a no-op when present)."""


def ensure_indexes(db):
    if db is None:
        return

    db['apps'].create_index('package_name', unique=True)
    db['apps'].create_index('api_key', unique=True)

    db['issues'].create_index([('app_id', 1), ('fingerprint', 1)], unique=True)
    db['issues'].create_index([('app_id', 1), ('last_seen', -1)])
    db['issues'].create_index([('app_id', 1), ('status', 1), ('event_count', -1)])

    db['events'].create_index([('issue_id', 1), ('timestamp', -1)])
    db['events'].create_index([('app_id', 1), ('received_at', -1)])
    db['events'].create_index([('app_id', 1), ('app_version', 1)])

    db['issue_users'].create_index([('issue_id', 1), ('install_id', 1)], unique=True)

    db['sessions'].create_index([('app_id', 1), ('received_at', -1)])
