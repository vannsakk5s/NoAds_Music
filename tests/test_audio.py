import os
import pytest
from unittest.mock import patch, MagicMock
from app.services.audio_service import (
    get_audio_dir,
    get_audio_file_path,
    is_audio_downloaded,
    download_youtube_audio
)
from app.models.song import Song


def test_audio_paths(app):
    with app.app_context():
        audio_dir = get_audio_dir()
        assert os.path.isdir(audio_dir)
        path = get_audio_file_path('dQw4w9WgXcQ')
        assert path.endswith('dQw4w9WgXcQ.mp3')


def test_is_audio_downloaded_false_when_absent(app):
    with app.app_context():
        assert is_audio_downloaded('nonexistent_id') is False


def test_is_audio_downloaded_true_when_present(app):
    with app.app_context():
        path = get_audio_file_path('test_mock_id')
        with open(path, 'wb') as f:
            f.write(b'X' * 2048)

        try:
            assert is_audio_downloaded('test_mock_id') is True
            res = download_youtube_audio('test_mock_id')
            assert res['success'] is True
            assert res['already_cached'] is True
        finally:
            if os.path.exists(path):
                os.remove(path)


def test_audio_stream_endpoint(client, app):
    with app.app_context():
        path = get_audio_file_path('stream_test_id')
        with open(path, 'wb') as f:
            f.write(b'RIFF' + b'\x00' * 2048)

        try:
            resp = client.get('/api/audio/stream_test_id.mp3')
            assert resp.status_code == 200
            assert resp.headers.get('Content-Type') == 'audio/mpeg'
            resp.close()
        finally:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except PermissionError:
                    pass
