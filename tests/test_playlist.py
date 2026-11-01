from unittest.mock import patch
from app.models.song import Song
from app.models.saved_song import SavedSong
from app.models.playlist import Playlist
from app.models.playlist_song import PlaylistSong
from tests.conftest import login_client


def test_playlist_creation_and_empty_name(client, user1):
    login_client(client, email='user1@example.com')

    # Valid creation
    res = client.post('/api/playlists', json={
        'name': 'My Chill Playlist',
        'description': 'Lofi and beats'
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data['playlist']['name'] == 'My Chill Playlist'

    # Empty name rejected
    res_empty = client.post('/api/playlists', json={'name': '   '})
    assert res_empty.status_code == 400
    assert 'name is required' in res_empty.get_json()['error']


def test_playlist_reordering_and_deterministic_order(client, user1, app):
    login_client(client, email='user1@example.com')

    # Create 3 songs in database
    with app.app_context():
        s1 = Song(youtube_video_id='video111111', title='Track 1')
        s2 = Song(youtube_video_id='video222222', title='Track 2')
        s3 = Song(youtube_video_id='video333333', title='Track 3')
        app.extensions['sqlalchemy'].session.add_all([s1, s2, s3])
        app.extensions['sqlalchemy'].session.commit()
        s1_id, s2_id, s3_id = s1.id, s2.id, s3.id

    # Create playlist
    pl_res = client.post('/api/playlists', json={'name': 'Order Test Playlist'})
    pl_id = pl_res.get_json()['playlist']['id']

    # Add 3 songs sequentially
    client.post(f'/api/playlists/{pl_id}/songs', json={'song_id': s1_id})
    client.post(f'/api/playlists/{pl_id}/songs', json={'song_id': s2_id})
    client.post(f'/api/playlists/{pl_id}/songs', json={'song_id': s3_id})

    # Verify initial positions: s1:0, s2:1, s3:2
    detail_res = client.get(f'/api/playlists/{pl_id}')
    songs = detail_res.get_json()['playlist']['songs']
    assert [s['id'] for s in songs] == [s1_id, s2_id, s3_id]

    # Reorder to [s3, s1, s2]
    reorder_res = client.put(f'/api/playlists/{pl_id}/order', json={
        'song_ids': [s3_id, s1_id, s2_id]
    })
    assert reorder_res.status_code == 200

    # Verify new deterministic order
    detail_res2 = client.get(f'/api/playlists/{pl_id}')
    new_songs = detail_res2.get_json()['playlist']['songs']
    assert [s['id'] for s in new_songs] == [s3_id, s1_id, s2_id]
    assert [s['position'] for s in new_songs] == [0, 1, 2]

    # Reorder with invalid/missing IDs should be rejected
    invalid_res = client.put(f'/api/playlists/{pl_id}/order', json={
        'song_ids': [s3_id, s1_id]  # Missing s2_id
    })
    assert invalid_res.status_code == 400


def test_delete_playlist_preserves_library_songs(client, user1, app):
    login_client(client, email='user1@example.com')

    with app.app_context():
        song = Song(youtube_video_id='preserve1234', title='Preserve Me')
        app.extensions['sqlalchemy'].session.add(song)
        app.extensions['sqlalchemy'].session.commit()
        song_id = song.id

    # Create playlist and add song
    pl_res = client.post('/api/playlists', json={'name': 'Temporary Playlist'})
    pl_id = pl_res.get_json()['playlist']['id']
    client.post(f'/api/playlists/{pl_id}/songs', json={'song_id': song_id})

    # Delete playlist
    del_res = client.delete(f'/api/playlists/{pl_id}')
    assert del_res.status_code == 200

    with app.app_context():
        # Playlist is gone
        assert app.extensions['sqlalchemy'].session.get(Playlist, pl_id) is None
        # Song is still in user library
        assert SavedSong.query.filter_by(user_id=user1.id, song_id=song_id).first() is not None
        # Song is still in shared catalog
        assert app.extensions['sqlalchemy'].session.get(Song, song_id) is not None


def test_playlist_ownership_isolation(client, user1, user2):
    # User 1 creates playlist
    login_client(client, email='user1@example.com')
    pl_res = client.post('/api/playlists', json={'name': "User 1 Private Playlist"})
    pl_id = pl_res.get_json()['playlist']['id']

    # User 2 attempts to view User 1's playlist
    login_client(client, email='user2@example.com')
    view_res = client.get(f'/api/playlists/{pl_id}')
    assert view_res.status_code == 400
    assert "not found or you do not have permission" in view_res.get_json()['error']

    # User 2 attempts to delete User 1's playlist
    del_res = client.delete(f'/api/playlists/{pl_id}')
    assert del_res.status_code == 400


@patch('app.blueprints.api.routes.fetch_youtube_playlist_info')
def test_playlist_metadata_preview(mock_fetch_info, client, user1):
    login_client(client, email='user1@example.com')

    mock_fetch_info.return_value = {
        'success': True,
        'playlist_id': 'PLB67v-2te-VE',
        'title': 'Vibe EN',
        'channel_name': 'Test Channel',
        'description': 'Lofi vibes',
        'song_count': 8,
        'thumbnail_url': 'https://example.com/thumb.jpg',
        'songs': [
            {'video_id': 'vid11111111', 'title': 'Song 1', 'channel_name': 'Chan 1', 'thumbnail_url': 'https://example.com/1.jpg'}
        ]
    }

    res = client.post('/api/youtube/playlist/metadata', json={
        'url': 'https://youtube.com/playlist?list=PLB67v-2te-VE'
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['title'] == 'Vibe EN'
    assert data['song_count'] == 8

    # Empty URL error
    res_err = client.post('/api/youtube/playlist/metadata', json={'url': ''})
    assert res_err.status_code == 400


@patch('app.services.playlist_service.fetch_youtube_playlist_info')
def test_playlist_import_from_youtube(mock_fetch_info, client, user1, app):
    login_client(client, email='user1@example.com')

    mock_fetch_info.return_value = {
        'success': True,
        'playlist_id': 'PLB67v-2te-VE',
        'title': 'Vibe EN',
        'channel_name': 'Test Channel',
        'description': 'Lofi vibes',
        'song_count': 2,
        'thumbnail_url': 'https://example.com/thumb.jpg',
        'songs': [
            {'video_id': 'importvid001', 'title': 'Imported Track 1', 'channel_name': 'Artist 1', 'thumbnail_url': 'https://example.com/1.jpg'},
            {'video_id': 'importvid002', 'title': 'Imported Track 2', 'channel_name': 'Artist 2', 'thumbnail_url': 'https://example.com/2.jpg'}
        ]
    }

    # Import new playlist
    res = client.post('/api/playlists/import', json={
        'url': 'https://youtube.com/playlist?list=PLB67v-2te-VE',
        'name': 'Custom Vibe Playlist',
        'download_audio': False
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data['added_count'] == 2
    assert data['playlist']['name'] == 'Custom Vibe Playlist'
    assert len(data['playlist']['songs']) == 2
    pl_id = data['playlist']['id']

    # Verify database state
    with app.app_context():
        pl = app.extensions['sqlalchemy'].session.get(Playlist, pl_id)
        assert pl is not None
        assert pl.name == 'Custom Vibe Playlist'
        assert len(pl.playlist_songs) == 2

        # Check songs exist in catalog
        s1 = Song.query.filter_by(youtube_video_id='importvid001').first()
        assert s1 is not None
        assert s1.title == 'Imported Track 1'

        # Check saved in user library
        saved1 = SavedSong.query.filter_by(user_id=user1.id, song_id=s1.id).first()
        assert saved1 is not None

