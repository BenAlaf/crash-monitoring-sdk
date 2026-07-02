"""Fingerprint-based crash grouping — the core of "one bug = one Issue".

Recipe (see IMPLEMENTATION_PLAN.md §1 and docs/data-model.md):
  - take the ROOT CAUSE (deepest exception in the cause chain)
  - take up to 5 stack frames whose class lives inside the app's package
    (fallback: first 3 frames overall when no in-app frame exists)
  - hash package name + root exception type + "class#method" per frame

Deliberately EXCLUDED, so the same bug always maps to the same issue:
  - exception message (varies per occurrence: "index 5" vs "index 7")
  - line numbers (survive cosmetic edits and version drift)
  - app version (same bug across versions = one issue with a version breakdown)
"""
import hashlib

MAX_IN_APP_FRAMES = 5
FALLBACK_FRAMES = 3


def _root_cause(exception):
    root = exception
    while isinstance(root.get('cause'), dict):
        root = root['cause']
    return root


def _pick_frames(package_name, frames):
    in_app = [f for f in frames if (f.get('cls') or '').startswith(package_name)]
    if in_app:
        return in_app[:MAX_IN_APP_FRAMES]
    return frames[:FALLBACK_FRAMES]


def compute_fingerprint(package_name, exception):
    """Return the SHA-256 hex fingerprint for a structured exception."""
    root = _root_cause(exception)
    frames = _pick_frames(package_name, root.get('frames') or [])

    parts = [package_name, root.get('type') or 'unknown']
    parts += [f"{f.get('cls') or '?'}#{f.get('method') or '?'}" for f in frames]

    signature = '|'.join(parts)
    return hashlib.sha256(signature.encode('utf-8')).hexdigest()


def issue_display_fields(package_name, exception):
    """Derive the human-facing identity of the issue: type, location, message."""
    root = _root_cause(exception)
    frames = _pick_frames(package_name, root.get('frames') or [])

    location = 'unknown'
    if frames:
        cls = frames[0].get('cls') or '?'
        simple_cls = cls.rsplit('.', 1)[-1]
        location = f"{simple_cls}#{frames[0].get('method') or '?'}"

    return {
        'exception_type': root.get('type') or 'unknown',
        'location': location,
        'sample_message': (root.get('message') or '')[:500],
    }
