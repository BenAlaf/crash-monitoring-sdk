import uuid
from datetime import datetime, timezone

from flask import request, jsonify, Blueprint

from mongodb_connection_holder import MongoConnectionHolder
from services.auth import require_admin_key

apps_blueprint = Blueprint('apps', __name__)


# 1. Register a new app (Create)
@apps_blueprint.route('/api/v1/apps', methods=['POST'])
@require_admin_key
def create_app():
    """
    Register a new application. Returns the generated api_key — shown only once in the portal.
    ---
    tags: [Apps (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
        - name: app
          in: body
          required: true
          schema:
            id: NewApp
            required: [name, package_name]
            properties:
                name:
                    type: string
                    description: Display name of the application
                package_name:
                    type: string
                    description: Android package name (unique)
    responses:
        201:
            description: App registered, api_key returned
        400:
            description: Invalid input
        401:
            description: Missing or invalid admin key
        409:
            description: package_name already registered
        500:
            description: Database error
    """
    data = request.json or {}
    db = MongoConnectionHolder.get_db()

    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500

    if not data.get('name') or not data.get('package_name'):
        return jsonify({'error': 'Invalid input: name and package_name are required'}), 400

    if db['apps'].find_one({'package_name': data['package_name']}):
        return jsonify({'error': 'An app with this package_name already exists'}), 409

    now = datetime.now(timezone.utc)
    app_item = {
        '_id': str(uuid.uuid4()),
        'name': data['name'],
        'package_name': data['package_name'],
        'api_key': str(uuid.uuid4()),
        'created_at': now,
        'updated_at': now,
    }
    db['apps'].insert_one(app_item)

    return jsonify(app_item), 201


# 2. List all apps (Read)
@apps_blueprint.route('/api/v1/apps', methods=['GET'])
@require_admin_key
def list_apps():
    """
    List all registered apps with issue/event counts.
    ---
    tags: [Apps (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
    responses:
        200:
            description: List of apps
        401:
            description: Missing or invalid admin key
        500:
            description: Database error
    """
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500

    apps = []
    for app_doc in db['apps'].find():
        app_doc['issue_count'] = db['issues'].count_documents({'app_id': app_doc['_id']})
        app_doc['event_count'] = db['events'].count_documents({'app_id': app_doc['_id']})
        apps.append(app_doc)

    return jsonify(apps), 200


# 3. Get one app (Read)
@apps_blueprint.route('/api/v1/apps/<app_id>', methods=['GET'])
@require_admin_key
def get_app(app_id):
    """
    Get a single app by id.
    ---
    tags: [Apps (admin)]
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
            description: The app
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

    app_doc = db['apps'].find_one({'_id': app_id})
    if app_doc is None:
        return jsonify({'error': 'App not found'}), 404

    return jsonify(app_doc), 200


# 4. Update an app (Update)
@apps_blueprint.route('/api/v1/apps/<app_id>', methods=['PUT'])
@require_admin_key
def update_app(app_id):
    """
    Update an app: rename and/or regenerate its api_key.
    ---
    tags: [Apps (admin)]
    parameters:
        - name: X-Admin-Key
          in: header
          type: string
          required: true
        - name: app_id
          in: path
          type: string
          required: true
        - name: update
          in: body
          required: true
          schema:
            id: UpdateApp
            properties:
                name:
                    type: string
                    description: New display name
                regenerate_api_key:
                    type: boolean
                    description: When true, a fresh api_key is generated and returned
    responses:
        200:
            description: Updated app
        400:
            description: Nothing to update
        401:
            description: Missing or invalid admin key
        404:
            description: App not found
        500:
            description: Database error
    """
    data = request.json or {}
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500

    updates = {}
    if data.get('name'):
        updates['name'] = data['name']
    if data.get('regenerate_api_key'):
        updates['api_key'] = str(uuid.uuid4())

    if not updates:
        return jsonify({'error': 'Nothing to update: provide name and/or regenerate_api_key'}), 400

    updates['updated_at'] = datetime.now(timezone.utc)
    result = db['apps'].find_one_and_update(
        {'_id': app_id}, {'$set': updates}, return_document=True
    )
    if result is None:
        return jsonify({'error': 'App not found'}), 404

    return jsonify(result), 200


# 5. Delete an app and all its data (Delete, cascading)
@apps_blueprint.route('/api/v1/apps/<app_id>', methods=['DELETE'])
@require_admin_key
def delete_app(app_id):
    """
    Delete an app and cascade-delete all its issues, events, users and sessions.
    ---
    tags: [Apps (admin)]
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
            description: App and all related data deleted
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

    app_doc = db['apps'].find_one({'_id': app_id})
    if app_doc is None:
        return jsonify({'error': 'App not found'}), 404

    issue_ids = [i['_id'] for i in db['issues'].find({'app_id': app_id}, {'_id': 1})]

    deleted_events = db['events'].delete_many({'app_id': app_id}).deleted_count
    db['issue_users'].delete_many({'issue_id': {'$in': issue_ids}})
    deleted_issues = db['issues'].delete_many({'app_id': app_id}).deleted_count
    db['sessions'].delete_many({'app_id': app_id})
    db['apps'].delete_one({'_id': app_id})

    return jsonify({
        'message': 'App deleted',
        'deleted_issues': deleted_issues,
        'deleted_events': deleted_events,
    }), 200
