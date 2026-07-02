import os

from flask import Blueprint, send_from_directory

portal_blueprint = Blueprint('portal', __name__)

PORTAL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'portal')


@portal_blueprint.route('/portal/', methods=['GET'])
def portal_index():
    """
    Admin portal (single-page app). Authenticates with the admin key in-browser.
    ---
    tags: [Portal]
    responses:
        200:
            description: Portal HTML
    """
    return send_from_directory(PORTAL_DIR, 'index.html')


@portal_blueprint.route('/portal/<path:filename>', methods=['GET'])
def portal_asset(filename):
    return send_from_directory(PORTAL_DIR, filename)
