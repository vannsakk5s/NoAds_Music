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


def test_song_to_dict_always_provides_audio_url(app):
    with app.app_context():
        song = Song(youtube_video_id='test1234567', title='Test Title')
        d = song.to_dict()
        assert d['audio_url'] == '/api/audio/test1234567.mp3'
        assert d['is_downloaded'] is False


@patch('app.blueprints.api.routes.download_youtube_audio')
def test_audio_stream_on_demand_download_when_absent(mock_download, client, app):
    with app.app_context():
        # Simulate successful download creating the file
        path = get_audio_file_path('ondemand_id')

        def side_effect(vid):
            with open(path, 'wb') as f:
                f.write(b'RIFF' + b'\x00' * 2048)
            return {'success': True, 'video_id': vid, 'file_name': f"{vid}.mp3", 'already_cached': False}

        mock_download.side_effect = side_effect

        try:
            resp = client.get('/api/audio/ondemand_id.mp3')
            assert resp.status_code == 200
            assert mock_download.called
            resp.close()
        finally:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except PermissionError:
                    pass
