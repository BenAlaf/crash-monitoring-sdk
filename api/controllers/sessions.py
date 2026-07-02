import uuid
from datetime import datetime, timezone

from flask import request, jsonify, Blueprint

from mongodb_connection_holder import MongoConnectionHolder
from services.auth import require_api_key

sessions_blueprint = Blueprint('sessions', __name__)


@sessions_blueprint.route('/api/v1/sessions', methods=['POST'])
@require_api_key
def record_session(app_doc):
    """
    Session ping — sent fire-and-forget by the SDK on every app launch.
    Insert-only; supplies the denominator for the crash-free-users metric.
    ---
    tags: [Sessions (SDK)]
    parameters:
        - name: X-API-Key
          in: header
          type: string
          required: true
        - name: session
          in: body
          required: true
          schema:
            id: SessionPing
            required: [install_id]
            properties:
                install_id:
                    type: string
                    description: Anonymous per-install UUID
                app:
                    type: object
                    description: "{package_name, version_name, version_code}"
                device:
                    type: object
                    description: "{manufacturer, model, os_version, sdk_int}"
    responses:
        201:
            description: Session recorded
        400:
            description: Invalid payload
        401:
            description: Missing or invalid API key
        500:
            description: Database error
    """
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500

    data = request.json or {}
    if not data.get('install_id'):
        return jsonify({'error': 'install_id is required'}), 400

    app_info = data.get('app') or {}
    device = data.get('device') or {}

    session = {
        '_id': str(uuid.uuid4()),
        'app_id': app_doc['_id'],
        'install_id': str(data['install_id']),
        'received_at': datetime.now(timezone.utc),
        'app_version': app_info.get('version_name'),
        'version_code': app_info.get('version_code'),
        'os_version': device.get('os_version'),
        'sdk_int': device.get('sdk_int'),
        'device_manufacturer': device.get('manufacturer'),
        'device_model': device.get('model'),
    }
    db['sessions'].insert_one(session)

    return jsonify({'session_id': session['_id']}), 201
