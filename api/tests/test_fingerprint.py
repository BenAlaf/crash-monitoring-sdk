"""Unit tests for the grouping recipe — the one piece of the API with real algorithmic risk."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fingerprint import compute_fingerprint, issue_display_fields

PKG = 'com.example.foo'


def _exc(type_='java.lang.NullPointerException', message='boom', frames=None, cause=None):
    return {
        'type': type_,
        'message': message,
        'frames': frames if frames is not None else [
            {'cls': 'com.example.foo.MainActivity', 'method': 'onClick', 'file': 'MainActivity.kt', 'line': 42},
            {'cls': 'android.view.View', 'method': 'performClick', 'file': 'View.java', 'line': 7659},
        ],
        'cause': cause,
    }


def test_same_bug_same_fingerprint():
    assert compute_fingerprint(PKG, _exc()) == compute_fingerprint(PKG, _exc())


def test_message_is_ignored():
    a = _exc(message='index 5 out of bounds')
    b = _exc(message='index 7 out of bounds')
    assert compute_fingerprint(PKG, a) == compute_fingerprint(PKG, b)


def test_line_numbers_are_ignored():
    frames_a = [{'cls': 'com.example.foo.MainActivity', 'method': 'onClick', 'line': 42}]
    frames_b = [{'cls': 'com.example.foo.MainActivity', 'method': 'onClick', 'line': 97}]
    assert compute_fingerprint(PKG, _exc(frames=frames_a)) == compute_fingerprint(PKG, _exc(frames=frames_b))


def test_different_exception_type_differs():
    a = _exc(type_='java.lang.NullPointerException')
    b = _exc(type_='java.lang.IllegalStateException')
    assert compute_fingerprint(PKG, a) != compute_fingerprint(PKG, b)


def test_different_in_app_location_differs():
    a = _exc(frames=[{'cls': 'com.example.foo.MainActivity', 'method': 'onClick'}])
    b = _exc(frames=[{'cls': 'com.example.foo.CartActivity', 'method': 'checkout'}])
    assert compute_fingerprint(PKG, a) != compute_fingerprint(PKG, b)


def test_root_cause_wins_over_wrapper():
    root = _exc(type_='java.io.IOException',
                frames=[{'cls': 'com.example.foo.Uploader', 'method': 'send'}])
    wrapped = _exc(type_='java.lang.RuntimeException',
                   frames=[{'cls': 'com.example.foo.MainActivity', 'method': 'onClick'}],
                   cause=root)
    assert compute_fingerprint(PKG, wrapped) == compute_fingerprint(PKG, root)


def test_fallback_when_no_in_app_frames():
    frames = [
        {'cls': 'android.os.Handler', 'method': 'dispatchMessage'},
        {'cls': 'android.os.Looper', 'method': 'loop'},
    ]
    fp = compute_fingerprint(PKG, _exc(frames=frames))
    assert fp == compute_fingerprint(PKG, _exc(frames=frames))
    assert fp != compute_fingerprint(PKG, _exc())


def test_display_fields():
    fields = issue_display_fields(PKG, _exc())
    assert fields['exception_type'] == 'java.lang.NullPointerException'
    assert fields['location'] == 'MainActivity#onClick'
    assert fields['sample_message'] == 'boom'
