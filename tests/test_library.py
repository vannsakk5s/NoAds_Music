from unittest.mock import patch, MagicMock
from app.models.song import Song
from app.models.saved_song import SavedSong
from app.models.playlist import Playlist
from app.models.playlist_song import PlaylistSong
from app.models.listening_history import ListeningHistory
from tests.conftest import login_client


@patch('app.blueprints.api.routes.fetch_youtube_metadata')
def test_add_song_idempotent(mock_fetch, client, user1, app):
    mock_fetch.return_value = {
        'success': True,
        'title': 'Mocked Track',
        'channel_name': 'Mock Artist',
        'thumbnail_url': 'https://example.com/thumb.jpg'
    }

    login_client(client, email='user1@example.com')

    # First save
    res1 = client.post('/api/library', json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})
    assert res1.status_code == 201
    data1 = res1.get_json()
    assert data1['already_saved'] is False
    assert data1['song']['title'] == 'Mocked Track'

    # Duplicate save -> Should be idempotent (status 200, friendly message)
    res2 = client.post('/api/library', json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})
    assert res2.status_code == 200
    data2 = res2.get_json()
    assert data2['already_saved'] is True
    assert "already in your library" in data2['message']

    with app.app_context():
        # Only 1 shared Song record created
        assert Song.query.filter_by(youtube_video_id='dQw4w9WgXcQ').count() == 1
        # Only 1 SavedSong for user1
        assert SavedSong.query.filter_by(user_id=user1.id).count() == 1


def test_favorites_toggle(client, user1, app):
    login_client(client, email='user1@example.com')

    with app.app_context():
        song = Song(youtube_video_id='abcdefghijk', title='Favorite Song')
        app.extensions['sqlalchemy'].session.add(song)
        app.extensions['sqlalchemy'].session.commit()
        song_id = song.id

    # Add to favorites
    res = client.put(f'/api/library/{song_id}/favorite', json={'is_favorite': True})
    assert res.status_code == 200
    assert res.get_json()['is_favorite'] is True

    # Check favorites list
    res_list = client.get('/api/favorites')
    favs = res_list.get_json()
    assert len(favs) == 1
    assert favs[0]['title'] == 'Favorite Song'

    # Unfavorite
    res_unfav = client.put(f'/api/library/{song_id}/favorite', json={'is_favorite': False})
    assert res_unfav.status_code == 200
    assert res_unfav.get_json()['is_favorite'] is False


@patch('app.blueprints.api.routes.fetch_youtube_metadata')
def test_library_removal_cascades_only_to_current_user(mock_fetch, client, user1, user2, app):
    mock_fetch.return_value = {
        'success': True,
        'title': 'Shared Hit Song',
        'channel_name': 'Universal Artist',
        'thumbnail_url': 'https://example.com/hit.jpg'
    }

    # 1. User 1 adds song
    login_client(client, email='user1@example.com')
    res = client.post('/api/library', json={'url': 'https://www.youtube.com/watch?v=11111111111'})
    song_id = res.get_json()['song']['id']

    # User 1 creates playlist and adds the song
    pl_res = client.post('/api/playlists', json={'name': "User 1's Playlist"})
    pl_id = pl_res.get_json()['playlist']['id']
    client.post(f'/api/playlists/{pl_id}/songs', json={'song_id': song_id})

    # User 1 records listening history
    client.post('/api/history', json={'song_id': song_id})

    # 2. User 2 logs in and also adds the same song
    login_client(client, email='user2@example.com')
    client.post('/api/library', json={'url': 'https://www.youtube.com/watch?v=11111111111'})

    # 3. User 1 logs back in and deletes the song from User 1's library
    login_client(client, email='user1@example.com')
    del_res = client.delete(f'/api/library/{song_id}')
    assert del_res.status_code == 200

    with app.app_context():
        # User 1's saved song is gone
        assert SavedSong.query.filter_by(user_id=user1.id, song_id=song_id).first() is None
        # User 1's playlist song is gone
        assert PlaylistSong.query.filter_by(playlist_id=pl_id, song_id=song_id).first() is None
        # User 1's listening history is gone
        assert ListeningHistory.query.filter_by(user_id=user1.id, song_id=song_id).first() is None

        # User 2's saved song is STILL PRESENT!
        assert SavedSong.query.filter_by(user_id=user2.id, song_id=song_id).first() is not None
        # Shared catalog record STILL EXISTS!
        assert Song.query.filter_by(id=song_id).first() is not None
