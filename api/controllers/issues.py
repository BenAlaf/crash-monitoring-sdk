from datetime import datetime, timezone

from flask import request, jsonify, Blueprint

from mongodb_connection_holder import MongoConnectionHolder
from services.auth import require_admin_key

issues_blueprint = Blueprint('issues', __name__)

SORT_FIELDS = {'last_seen', 'event_count', 'user_count', 'first_seen'}
STATUS_VALUES = {'open', 'resolved', 'ignored'}
MAX_LIMIT = 100


# 1. Grouped issue list for an app — the core portal view
@issues_blueprint.route('/api/v1/apps/<app_id>/issues', methods=['GET'])
@require_admin_key
def list_issues(app_id):
    """
    List grouped issues for an app, filterable and sortable.
    ---
    tags: [Issues (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
        - name: app_id
          in: path
          type: string
          required: true
        - name: status
          in: query
          type: string
          enum: [open, resolved, ignored]
        - name: is_fatal
          in: query
          type: boolean
        - name: app_version
          in: query
          type: string
          description: Only issues that occurred in this app version
        - name: sort
          in: query
          type: string
          enum: [last_seen, event_count, user_count, first_seen]
          default: last_seen
        - name: page
          in: query
          type: integer
          default: 1
        - name: limit
          in: query
          type: integer
          default: 20
    responses:
        200:
            description: "{issues, total, page, limit}"
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

    if db['apps'].find_one({'_id': app_id}) is None:
        return jsonify({'error': 'App not found'}), 404

    query = {'app_id': app_id}

    status = request.args.get('status')
    if status:
        if status not in STATUS_VALUES:
            return jsonify({'error': f'Invalid status (use one of {sorted(STATUS_VALUES)})'}), 400
        query['status'] = status

    is_fatal = request.args.get('is_fatal')
    if is_fatal is not None:
        query['is_fatal'] = is_fatal.lower() == 'true'

    app_version = request.args.get('app_version')
    if app_version:
        issue_ids = db['events'].distinct(
            'issue_id', {'app_id': app_id, 'app_version': app_version}
        )
        query['_id'] = {'$in': issue_ids}

    sort_field = request.args.get('sort', 'last_seen')
    if sort_field not in SORT_FIELDS:
        return jsonify({'error': f'Invalid sort (use one of {sorted(SORT_FIELDS)})'}), 400

    try:
        page = max(1, int(request.args.get('page', 1)))
        limit = min(MAX_LIMIT, max(1, int(request.args.get('limit', 20))))
    except ValueError:
        return jsonify({'error': 'page and limit must be integers'}), 400

    total = db['issues'].count_documents(query)
    issues = list(
        db['issues']
        .find(query)
        .sort(sort_field, -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )

    return jsonify({'issues': issues, 'total': total, 'page': page, 'limit': limit}), 200


# 2. Issue detail
@issues_blueprint.route('/api/v1/issues/<issue_id>', methods=['GET'])
@require_admin_key
def get_issue(issue_id):
    """
    Get one issue, including its representative last stack trace.
    ---
    tags: [Issues (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
        - name: issue_id
          in: path
          type: string
          required: true
    responses:
        200:
            description: The issue
        401:
            description: Missing or invalid admin key
        404:
            description: Issue not found
        500:
            description: Database error
    """
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500

    issue = db['issues'].find_one({'_id': issue_id})
    if issue is None:
        return jsonify({'error': 'Issue not found'}), 404

    return jsonify(issue), 200


# 3. Occurrences of an issue
@issues_blueprint.route('/api/v1/issues/<issue_id>/events', methods=['GET'])
@require_admin_key
def list_issue_events(issue_id):
    """
    List the individual occurrences (events) of an issue, newest first.
    ---
    tags: [Issues (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
        - name: issue_id
          in: path
          type: string
          required: true
        - name: page
          in: query
          type: integer
          default: 1
        - name: limit
          in: query
          type: integer
          default: 20
    responses:
        200:
            description: "{events, total, page, limit}"
        401:
            description: Missing or invalid admin key
        404:
            description: Issue not found
        500:
            description: Database error
    """
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500

    if db['issues'].find_one({'_id': issue_id}) is None:
        return jsonify({'error': 'Issue not found'}), 404

    try:
        page = max(1, int(request.args.get('page', 1)))
        limit = min(MAX_LIMIT, max(1, int(request.args.get('limit', 20))))
    except ValueError:
        return jsonify({'error': 'page and limit must be integers'}), 400

    query = {'issue_id': issue_id}
    total = db['events'].count_documents(query)
    events = list(
        db['events']
        .find(query)
        .sort('timestamp', -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )

    return jsonify({'events': events, 'total': total, 'page': page, 'limit': limit}), 200


# 4. Update issue status (Update)
@issues_blueprint.route('/api/v1/issues/<issue_id>', methods=['PATCH'])
@require_admin_key
def update_issue(issue_id):
    """
    Update an issue's status (open / resolved / ignored).
    ---
    tags: [Issues (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
        - name: issue_id
          in: path
          type: string
          required: true
        - name: update
          in: body
          required: true
          schema:
            id: UpdateIssue
            required: [status]
            properties:
                status:
                    type: string
                    enum: [open, resolved, ignored]
    responses:
        200:
            description: Updated issue
        400:
            description: Invalid status
        401:
            description: Missing or invalid admin key
        404:
            description: Issue not found
        500:
            description: Database error
    """
    data = request.json or {}
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500

    status = data.get('status')
    if status not in STATUS_VALUES:
        return jsonify({'error': f'Invalid status (use one of {sorted(STATUS_VALUES)})'}), 400

    issue = db['issues'].find_one_and_update(
        {'_id': issue_id},
        {'$set': {'status': status, 'updated_at': datetime.now(timezone.utc)}},
        return_document=True,
    )
    if issue is None:
        return jsonify({'error': 'Issue not found'}), 404

    return jsonify(issue), 200


# 5. Delete an issue and its events (Delete)
@issues_blueprint.route('/api/v1/issues/<issue_id>', methods=['DELETE'])
@require_admin_key
def delete_issue(issue_id):
    """
    Delete an issue together with all its events and user records.
    ---
    tags: [Issues (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
        - name: issue_id
          in: path
          type: string
          required: true
    responses:
        200:
            description: Issue deleted
        401:
            description: Missing or invalid admin key
        404:
            description: Issue not found
        500:
            description: Database error
    """
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500

    issue = db['issues'].find_one({'_id': issue_id})
    if issue is None:
        return jsonify({'error': 'Issue not found'}), 404

    deleted_events = db['events'].delete_many({'issue_id': issue_id}).deleted_count
    db['issue_users'].delete_many({'issue_id': issue_id})
    db['issues'].delete_one({'_id': issue_id})

    return jsonify({'message': 'Issue deleted', 'deleted_events': deleted_events}), 200
