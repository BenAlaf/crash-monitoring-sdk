import os
from functools import wraps

from flask import request, jsonify

from mongodb_connection_holder import MongoConnectionHolder


def require_admin_key(f):
    """Admin role: X-Admin-Key header must match the ADMIN_KEY env var."""

    @wraps(f)
    def decorated(*args, **kwargs):
        admin_key = os.getenv('ADMIN_KEY')
        provided = request.headers.get('X-Admin-Key')

        if not admin_key or provided != admin_key:
            return jsonify({'error': 'Unauthorized: missing or invalid X-Admin-Key'}), 401

        return f(*args, **kwargs)

    return decorated


def require_api_key(f):
    """SDK role: X-API-Key must belong to a registered app.

    The matching app document is injected as the first argument of the route.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        provided = request.headers.get('X-API-Key')
        if not provided:
            return jsonify({'error': 'Unauthorized: missing X-API-Key'}), 401

        db = MongoConnectionHolder.get_db()
        if db is None:
            return jsonify({'error': 'Could not connect to the database'}), 500

        app_doc = db['apps'].find_one({'api_key': provided})
        if app_doc is None:
            return jsonify({'error': 'Unauthorized: invalid X-API-Key'}), 401

        return f(app_doc, *args, **kwargs)

    return decorated
