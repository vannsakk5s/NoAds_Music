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


def test_cookie_file_detection_and_ytdlp_opts(app, monkeypatch):
    with app.app_context():
        from app.services.audio_service import get_cookie_file_path, get_ytdlp_base_opts
        
        # Test when no cookies file exists
        opts = get_ytdlp_base_opts()
        assert 'extractor_args' in opts
        assert 'tv_samsung' in opts['extractor_args']['youtube']['player_client']

        # Test with instance/cookies.txt mock
        fake_cookie = os.path.join(app.instance_path, 'cookies.txt')
        with open(fake_cookie, 'w') as f:
            f.write("# Netscape HTTP Cookie File\n.youtube.com TRUE / FALSE 1111111111 SID test")

        try:
            detected = get_cookie_file_path()
            assert detected == fake_cookie
            opts_with_cookie = get_ytdlp_base_opts()
            assert opts_with_cookie.get('cookiefile') == fake_cookie
        finally:
            if os.path.exists(fake_cookie):
                os.remove(fake_cookie)


def test_download_bot_error_handling(app, monkeypatch):
    with app.app_context():
        from app.services.audio_service import download_youtube_audio

        class FakeYDL:
            def __init__(self, opts):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def download(self, urls):
                raise Exception("ERROR: [youtube] test_vid: Sign in to confirm you're not a bot.")

        import yt_dlp
        monkeypatch.setattr(yt_dlp, 'YoutubeDL', FakeYDL)

        res = download_youtube_audio('bot_test_vid')
        assert res['success'] is False
        assert "cookies.txt" in res['error']
