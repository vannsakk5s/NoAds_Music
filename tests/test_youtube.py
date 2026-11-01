import pytest
from unittest.mock import patch, MagicMock
from app.services.youtube_service import (
    extract_video_id,
    extract_playlist_id,
    is_playlist_url,
    fetch_youtube_metadata,
    fetch_youtube_playlist_info,
    YouTubeValidationError
)


def test_extract_video_id_valid_formats():
    test_cases = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ?t=20", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://music.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrEnWoR732-BHrPp_pm8_VleD68f9n14-", "dQw4w9WgXcQ"),
    ]

    for url, expected_id in test_cases:
        assert extract_video_id(url) == expected_id, f"Failed for {url}"


def test_extract_video_id_rejected_urls():
    invalid_cases = [
        "https://vimeo.com/123456789",  # Unrelated domain
        "https://www.youtube.com/playlist?list=PLrEnWoR732-BHrPp",  # Playlist-only URL
        "https://www.youtube.com/watch?v=too_short",  # Invalid ID length (9 chars)
        "https://www.youtube.com/watch?v=way_too_long_video_id_123",  # Invalid ID length (>11 chars)
        "not-a-url",
        "",
        None
    ]

    for url in invalid_cases:
        with pytest.raises(YouTubeValidationError):
            extract_video_id(url)


@patch('requests.get')
def test_fetch_youtube_metadata_success(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        'title': 'Test Song Title',
        'author_name': 'Test Channel',
        'thumbnail_url': 'https://example.com/thumb.jpg'
    }
    mock_get.return_value = mock_resp

    meta = fetch_youtube_metadata('dQw4w9WgXcQ')
    assert meta['success'] is True
    assert meta['title'] == 'Test Song Title'
    assert meta['channel_name'] == 'Test Channel'
    assert meta['thumbnail_url'] == 'https://example.com/thumb.jpg'


@patch('requests.get')
def test_fetch_youtube_metadata_failure_fallback(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_get.return_value = mock_resp

    meta = fetch_youtube_metadata('dQw4w9WgXcQ')
    assert meta['success'] is False
    assert 'dQw4w9WgXcQ' in meta['title']
    assert meta['thumbnail_url'].startswith('https://img.youtube.com/vi/dQw4w9WgXcQ')


def test_extract_playlist_id_valid():
    valid_cases = [
        ("https://youtube.com/playlist?list=PLB67v-2te-VE&si=UZIFza2ztoXhMEBl", "PLB67v-2te-VE"),
        ("https://www.youtube.com/playlist?list=PLB67v-2te-VE", "PLB67v-2te-VE"),
        ("https://music.youtube.com/playlist?list=PLB67v-2te-VE", "PLB67v-2te-VE"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLB67v-2te-VE", "PLB67v-2te-VE"),
        ("https://youtu.be/dQw4w9WgXcQ?list=PLB67v-2te-VE", "PLB67v-2te-VE"),
        ("PLB67v-2te-VE", "PLB67v-2te-VE"),
    ]
    for url, expected_id in valid_cases:
        assert extract_playlist_id(url) == expected_id
        assert is_playlist_url(url) is True


def test_extract_playlist_id_invalid():
    invalid_cases = [
        "https://vimeo.com/playlist?list=PLB67v-2te-VE",  # Unsupported domain
        "https://youtube.com/watch?v=dQw4w9WgXcQ",  # Single video without list param
        "not-a-valid-id!",
        "",
        None
    ]
    for url in invalid_cases:
        assert is_playlist_url(url) is False
        with pytest.raises(YouTubeValidationError):
            extract_playlist_id(url)


@patch('yt_dlp.YoutubeDL')
def test_fetch_youtube_playlist_info(mock_ydl_cls):
    mock_ydl_instance = MagicMock()
    mock_ydl_instance.extract_info.return_value = {
        'title': 'Chill Lofi Mix',
        'uploader': 'Lofi Channel',
        'description': 'Best lofi beats',
        'entries': [
            {
                'id': 'video111111',
                'title': 'Track One',
                'uploader': 'Artist A',
                'thumbnails': [{'url': 'https://example.com/thumb1.jpg'}]
            },
            {
                'id': 'video222222',
                'title': 'Track Two',
                'uploader': 'Artist B',
                'thumbnails': [{'url': 'https://example.com/thumb2.jpg'}]
            }
        ]
    }
    mock_ydl_cls.return_value.__enter__.return_value = mock_ydl_instance

    res = fetch_youtube_playlist_info('https://youtube.com/playlist?list=PLB67v-2te-VE')
    assert res['success'] is True
    assert res['playlist_id'] == 'PLB67v-2te-VE'
    assert res['title'] == 'Chill Lofi Mix'
    assert res['song_count'] == 2
    assert len(res['songs']) == 2
    assert res['songs'][0]['video_id'] == 'video111111'
    assert res['songs'][1]['video_id'] == 'video222222'

