from flask import jsonify, Blueprint
from mongodb_connection_holder import MongoConnectionHolder

health_blueprint = Blueprint('health', __name__)


@health_blueprint.route('/', methods=['GET'])
def health():
    """
    Health check — service status and database connectivity
    ---
    responses:
        200:
            description: The service is running
    """
    db = MongoConnectionHolder.get_db()

    return jsonify({
        'service': 'CrashMonitor API',
        'status': 'ok',
        'database': 'connected' if db is not None else 'disconnected'
    }), 200
