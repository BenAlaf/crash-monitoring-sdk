from datetime import datetime, timedelta, timezone

from flask import request, jsonify, Blueprint

from mongodb_connection_holder import MongoConnectionHolder
from services.auth import require_admin_key

stats_blueprint = Blueprint('stats', __name__)

BREAKDOWN_FIELDS = {'app_version', 'os_version', 'device_model'}
MAX_DAYS = 90
MAX_BREAKDOWN_BUCKETS = 12


def _app_or_none(db, app_id):
    return db['apps'].find_one({'_id': app_id})


# 1. Overview cards
@stats_blueprint.route('/api/v1/apps/<app_id>/stats/overview', methods=['GET'])
@require_admin_key
def stats_overview(app_id):
    """
    Headline numbers for an app: totals, affected users, recent activity.
    ---
    tags: [Stats (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
        - name: app_id
          in: path
          type: string
          required: true
    responses:
        200:
            description: Overview counters
        401:
            description: Missing or invalid admin key
        404:
            description: App not found
        500:
            description: Database error
    """
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500
    if _app_or_none(db, app_id) is None:
        return jsonify({'error': 'App not found'}), 404

    now = datetime.now(timezone.utc)
    base = {'app_id': app_id}

    return jsonify({
        'total_events': db['events'].count_documents(base),
        'fatal_events': db['events'].count_documents({**base, 'is_fatal': True}),
        'total_issues': db['issues'].count_documents(base),
        'open_issues': db['issues'].count_documents({**base, 'status': 'open'}),
        'affected_users': len(db['events'].distinct('install_id', base)),
        'events_24h': db['events'].count_documents({**base, 'timestamp': {'$gte': now - timedelta(hours=24)}}),
        'events_7d': db['events'].count_documents({**base, 'timestamp': {'$gte': now - timedelta(days=7)}}),
    }), 200


# 2. Crashes over time (line chart)
@stats_blueprint.route('/api/v1/apps/<app_id>/stats/timeseries', methods=['GET'])
@require_admin_key
def stats_timeseries(app_id):
    """
    Events per day for the last N days; optionally scoped to one issue.
    ---
    tags: [Stats (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
        - name: app_id
          in: path
          type: string
          required: true
        - name: days
          in: query
          type: integer
          default: 30
        - name: issue_id
          in: query
          type: string
    responses:
        200:
            description: "{days: [{date, count, fatal}]} — zero-filled, oldest first"
        401:
            description: Missing or invalid admin key
        404:
            description: App not found
        500:
            description: Database error
    """
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500
    if _app_or_none(db, app_id) is None:
        return jsonify({'error': 'App not found'}), 404

    try:
        days = min(MAX_DAYS, max(1, int(request.args.get('days', 30))))
    except ValueError:
        return jsonify({'error': 'days must be an integer'}), 400

    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    match = {'app_id': app_id, 'timestamp': {'$gte': since}}
    if request.args.get('issue_id'):
        match['issue_id'] = request.args['issue_id']

    pipeline = [
        {'$match': match},
        {'$group': {
            '_id': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$timestamp'}},
            'count': {'$sum': 1},
            'fatal': {'$sum': {'$cond': ['$is_fatal', 1, 0]}},
        }},
    ]
    counts = {row['_id']: row for row in db['events'].aggregate(pipeline)}

    series = []
    for offset in range(days):
        day = (since + timedelta(days=offset)).strftime('%Y-%m-%d')
        row = counts.get(day, {})
        series.append({'date': day, 'count': row.get('count', 0), 'fatal': row.get('fatal', 0)})

    return jsonify({'days': series}), 200


# 3. Breakdown by version / OS / device (bar chart)
@stats_blueprint.route('/api/v1/apps/<app_id>/stats/breakdown', methods=['GET'])
@require_admin_key
def stats_breakdown(app_id):
    """
    Event counts and affected users grouped by app_version, os_version or device_model.
    ---
    tags: [Stats (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
        - name: app_id
          in: path
          type: string
          required: true
        - name: by
          in: query
          type: string
          enum: [app_version, os_version, device_model]
          default: app_version
        - name: days
          in: query
          type: integer
          description: Optional window; omit for all time
        - name: issue_id
          in: query
          type: string
    responses:
        200:
            description: "{buckets: [{key, count, users}]} sorted by count desc"
        400:
            description: Invalid query parameter
        401:
            description: Missing or invalid admin key
        404:
            description: App not found
        500:
            description: Database error
    """
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500
    if _app_or_none(db, app_id) is None:
        return jsonify({'error': 'App not found'}), 404

    by = request.args.get('by', 'app_version')
    if by not in BREAKDOWN_FIELDS:
        return jsonify({'error': f'Invalid by (use one of {sorted(BREAKDOWN_FIELDS)})'}), 400

    match = {'app_id': app_id}
    if request.args.get('issue_id'):
        match['issue_id'] = request.args['issue_id']
    if request.args.get('days'):
        try:
            days = min(MAX_DAYS, max(1, int(request.args['days'])))
        except ValueError:
            return jsonify({'error': 'days must be an integer'}), 400
        match['timestamp'] = {'$gte': datetime.now(timezone.utc) - timedelta(days=days)}

    pipeline = [
        {'$match': match},
        {'$group': {
            '_id': {'$ifNull': [f'${by}', 'unknown']},
            'count': {'$sum': 1},
            'users': {'$addToSet': '$install_id'},
        }},
        {'$project': {'count': 1, 'users': {'$size': '$users'}}},
        {'$sort': {'count': -1}},
        {'$limit': MAX_BREAKDOWN_BUCKETS},
    ]
    buckets = [
        {'key': row['_id'], 'count': row['count'], 'users': row['users']}
        for row in db['events'].aggregate(pipeline)
    ]

    return jsonify({'buckets': buckets, 'by': by}), 200
