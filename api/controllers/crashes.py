from flask import request, jsonify, Blueprint

from mongodb_connection_holder import MongoConnectionHolder
from services.auth import require_api_key
from services.ingest import process_report, validate_report, InvalidReport, MAX_BATCH

crashes_blueprint = Blueprint('crashes', __name__)


@crashes_blueprint.route('/api/v1/crashes', methods=['POST'])
@require_api_key
def ingest_crashes(app_doc):
    """
    Ingest crash/error report(s) from the SDK. Accepts one report object or an array (max 20) —
    the SDK's uploader drains its whole disk queue in a single call. Reports are grouped into
    issues by server-side fingerprint.
    ---
    tags: [Crashes (SDK)]
    parameters:
        - name: X-API-Key
          in: header
          type: string
          required: true
          description: The api_key of a registered app
        - name: reports
          in: body
          required: true
          description: One crash report object, or an array of them
          schema:
            id: CrashReport
            required: [install_id, timestamp, app, exception]
            properties:
                install_id:
                    type: string
                    description: Anonymous per-install UUID
                timestamp:
                    type: string
                    description: Crash time, ISO-8601 (e.g. 2026-07-02T14:03:22.123Z)
                is_fatal:
                    type: boolean
                    description: true = crash, false = handled error (default true)
                app:
                    type: object
                    description: "{package_name, version_name, version_code}"
                device:
                    type: object
                    description: "{manufacturer, model, os_version, sdk_int}"
                thread:
                    type: string
                exception:
                    type: object
                    description: "{type, message, frames: [{cls, method, file, line}], cause}"
                raw_stack_trace:
                    type: string
                breadcrumbs:
                    type: array
                    items:
                        type: object
                custom:
                    type: object
    responses:
        201:
            description: Array of {event_id, issue_id, fingerprint}, one per submitted report
        400:
            description: Invalid payload (nothing was stored)
        401:
            description: Missing or invalid API key
        500:
            description: Database error
    """
    db = MongoConnectionHolder.get_db()
    if db is None:
        return jsonify({'error': 'Could not connect to the database'}), 500

    payload = request.json
    if payload is None:
        return jsonify({'error': 'Missing JSON body'}), 400

    reports = payload if isinstance(payload, list) else [payload]
    if not reports:
        return jsonify({'error': 'Empty report list'}), 400
    if len(reports) > MAX_BATCH:
        return jsonify({'error': f'Too many reports in one batch (max {MAX_BATCH})'}), 400

    # validate everything up front — a batch is stored all-or-nothing
    for index, report in enumerate(reports):
        try:
            validate_report(report)
        except InvalidReport as e:
            return jsonify({'error': f'Report {index}: {e}'}), 400

    results = []
    for index, report in enumerate(reports):
        try:
            results.append(process_report(db, app_doc, report))
        except InvalidReport as e:
            return jsonify({'error': f'Report {index}: {e}', 'stored': results}), 400

    return jsonify(results), 201
