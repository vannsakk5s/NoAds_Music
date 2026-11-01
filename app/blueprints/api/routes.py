import os
import threading
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_login import current_user, login_required
from app.extensions import db
from app.models.song import Song
from app.models.saved_song import SavedSong
from app.models.playlist import Playlist
from app.models.playlist_song import PlaylistSong
from app.models.listening_history import ListeningHistory
from app.services.youtube_service import (
    extract_video_id,
    extract_playlist_id,
    fetch_youtube_metadata,
    fetch_youtube_playlist_info,
    is_playlist_url,
    YouTubeValidationError
)
from app.services.playlist_service import (
    get_user_playlist,
    add_song_to_playlist,
    remove_song_from_playlist,
    reorder_playlist_songs,
    remove_song_from_user_library,
    create_playlist_from_youtube,
    PlaylistError
)
from app.services.audio_service import download_youtube_audio, get_audio_dir

api_bp = Blueprint('api', __name__, url_prefix='/api')


@api_bp.errorhandler(YouTubeValidationError)
def handle_youtube_validation_error(err):
    return jsonify({'error': str(err)}), 400


@api_bp.errorhandler(PlaylistError)
def handle_playlist_error(err):
    return jsonify({'error': str(err)}), 400


# -------------------------------------------------------------
# YouTube Metadata Preview
# -------------------------------------------------------------
@api_bp.route('/youtube/metadata', methods=['POST'])
@login_required
def get_metadata():
    data = request.get_json(silent=True) or {}
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Please provide a YouTube URL.'}), 400

    video_id = extract_video_id(url)
    meta = fetch_youtube_metadata(video_id)
    return jsonify(meta), 200


@api_bp.route('/youtube/playlist/metadata', methods=['POST'])
@login_required
def get_playlist_metadata():
    data = request.get_json(silent=True) or {}
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Please provide a YouTube playlist URL.'}), 400

    info = fetch_youtube_playlist_info(url)
    return jsonify(info), 200


# -------------------------------------------------------------
# Library Endpoints
# -------------------------------------------------------------
@api_bp.route('/library', methods=['GET'])
@login_required
def get_library():
    query_str = request.args.get('q', '').strip().lower()

    base_query = (
        SavedSong.query
        .join(Song, SavedSong.song_id == Song.id)
        .filter(SavedSong.user_id == current_user.id)
    )

    if query_str:
        pattern = f"%{query_str}%"
        base_query = base_query.filter(
            db.or_(
                Song.title.ilike(pattern),
                Song.channel_name.ilike(pattern)
            )
        )

    saved_entries = base_query.order_by(SavedSong.created_at.desc()).all()
    return jsonify([entry.to_dict() for entry in saved_entries]), 200


@api_bp.route('/library', methods=['POST'])
@login_required
def add_to_library():
    data = request.get_json(silent=True) or {}
    url = data.get('url', '').strip()
    manual_title = data.get('title', '').strip()
    target_playlist_id = data.get('playlist_id')

    if not url:
        return jsonify({'error': 'A YouTube video URL is required.'}), 400

    video_id = extract_video_id(url)

    # 1. Shared catalog check or create
    song = Song.query.filter_by(youtube_video_id=video_id).first()
    if not song:
        meta = fetch_youtube_metadata(video_id)
        title = manual_title or meta.get('title') or f"YouTube Video ({video_id})"
        channel = meta.get('channel_name') or 'YouTube'
        thumbnail = meta.get('thumbnail_url') or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

        song = Song(
            youtube_video_id=video_id,
            title=title[:255],
            channel_name=channel[:255],
            thumbnail_url=thumbnail[:500]
        )
        db.session.add(song)
        db.session.flush()
    elif manual_title:
        # Optional title update if specified
        song.title = manual_title[:255]
        db.session.flush()

    # 2. Personal user library check or create
    saved = SavedSong.query.filter_by(user_id=current_user.id, song_id=song.id).first()
    already_saved = True
    if not saved:
        already_saved = False
        saved = SavedSong(
            user_id=current_user.id,
            song_id=song.id,
            is_favorite=False,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(saved)
        db.session.commit()

    # Automatically download audio stream for offline / restriction-free playback
    download_youtube_audio(video_id)

    # 3. Add to playlist if specified
    if target_playlist_id:
        try:
            pid = int(target_playlist_id)
            add_song_to_playlist(pid, song.id, current_user.id)
        except (ValueError, PlaylistError) as e:
            return jsonify({
                'message': 'Song saved to library, but could not add to playlist: ' + str(e),
                'song': saved.to_dict(),
                'already_saved': already_saved
            }), 200

    msg = 'Song is already in your library.' if already_saved else 'Song successfully added and downloaded for playback.'
    status_code = 200 if already_saved else 201
    return jsonify({
        'message': msg,
        'song': saved.to_dict(),
        'already_saved': already_saved
    }), status_code


@api_bp.route('/library/<int:song_id>', methods=['DELETE'])
@login_required
def delete_from_library(song_id):
    removed = remove_song_from_user_library(current_user.id, song_id)
    if not removed:
        return jsonify({'error': 'Song not found in your personal library.'}), 404
    return jsonify({'message': 'Song removed from your library and playlists.'}), 200


# -------------------------------------------------------------
# Favorites Endpoints
# -------------------------------------------------------------
@api_bp.route('/favorites', methods=['GET'])
@login_required
def get_favorites():
    entries = (
        SavedSong.query
        .join(Song, SavedSong.song_id == Song.id)
        .filter(SavedSong.user_id == current_user.id, SavedSong.is_favorite.is_(True))
        .order_by(SavedSong.created_at.desc())
        .all()
    )
    return jsonify([entry.to_dict() for entry in entries]), 200


@api_bp.route('/library/<int:song_id>/favorite', methods=['PUT'])
@login_required
def toggle_favorite(song_id):
    data = request.get_json(silent=True) or {}
    if 'is_favorite' not in data:
        return jsonify({'error': "Payload must explicitly contain boolean 'is_favorite'."}), 400

    is_fav = bool(data['is_favorite'])
    saved = SavedSong.query.filter_by(user_id=current_user.id, song_id=song_id).first()
    if not saved:
        # If not already in library, add it and mark favorite
        song = db.session.get(Song, song_id)
        if not song:
            return jsonify({'error': 'Song does not exist.'}), 404
        saved = SavedSong(
            user_id=current_user.id,
            song_id=song.id,
            is_favorite=is_fav,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(saved)
    else:
        saved.is_favorite = is_fav

    db.session.commit()
    return jsonify({
        'message': 'Favorite status updated successfully.',
        'is_favorite': saved.is_favorite,
        'song_id': song_id
    }), 200


# -------------------------------------------------------------
# Playlists Endpoints
# -------------------------------------------------------------
@api_bp.route('/playlists', methods=['GET'])
@login_required
def list_playlists():
    playlists = (
        Playlist.query
        .filter_by(user_id=current_user.id)
        .order_by(Playlist.updated_at.desc())
        .all()
    )
    return jsonify([p.to_dict() for p in playlists]), 200


@api_bp.route('/playlists', methods=['POST'])
@login_required
def create_playlist():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    description = (data.get('description') or '').strip()

    if not name:
        return jsonify({'error': 'Playlist name is required.'}), 400
    if len(name) > 150:
        return jsonify({'error': 'Playlist name cannot exceed 150 characters.'}), 400

    playlist = Playlist(
        user_id=current_user.id,
        name=name,
        description=description,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.session.add(playlist)
    db.session.commit()

    return jsonify({
        'message': 'Playlist created successfully.',
        'playlist': playlist.to_dict(include_songs=True)
    }), 201


@api_bp.route('/playlists/import', methods=['POST'])
@login_required
def import_playlist():
    data = request.get_json(silent=True) or {}
    url = data.get('url', '').strip()
    custom_name = data.get('name', '').strip() or None
    custom_desc = data.get('description', '').strip() if 'description' in data else None
    download_audio = bool(data.get('download_audio', True))
    target_playlist_id = data.get('playlist_id')

    if not url:
        return jsonify({'error': 'A YouTube playlist URL is required.'}), 400

    playlist, added_count, video_ids = create_playlist_from_youtube(
        user_id=current_user.id,
        url=url,
        name=custom_name,
        description=custom_desc,
        target_playlist_id=target_playlist_id
    )

    if download_audio and video_ids:
        # Background worker for downloading audio without blocking HTTP response
        app_instance = current_app._get_current_object()

        def _bg_download(app_obj, vids):
            with app_obj.app_context():
                for vid in vids:
                    try:
                        download_youtube_audio(vid)
                    except Exception:
                        pass

        threading.Thread(target=_bg_download, args=(app_instance, video_ids), daemon=True).start()

    return jsonify({
        'message': f"Successfully imported {added_count} songs into playlist '{playlist.name}'.",
        'playlist': playlist.to_dict(include_songs=True),
        'added_count': added_count
    }), 201


@api_bp.route('/playlists/<int:playlist_id>', methods=['GET'])
@login_required
def get_playlist_detail(playlist_id):
    playlist = get_user_playlist(playlist_id, current_user.id)
    return jsonify({'playlist': playlist.to_dict(include_songs=True)}), 200


@api_bp.route('/playlists/<int:playlist_id>', methods=['PATCH'])
@login_required
def update_playlist(playlist_id):
    playlist = get_user_playlist(playlist_id, current_user.id)
    data = request.get_json(silent=True) or {}

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': 'Playlist name cannot be empty.'}), 400
        playlist.name = name[:150]

    if 'description' in data:
        playlist.description = (data['description'] or '').strip()

    playlist.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        'message': 'Playlist updated successfully.',
        'playlist': playlist.to_dict(include_songs=True)
    }), 200


@api_bp.route('/playlists/<int:playlist_id>', methods=['DELETE'])
@login_required
def delete_playlist(playlist_id):
    playlist = get_user_playlist(playlist_id, current_user.id)
    db.session.delete(playlist)
    db.session.commit()
    return jsonify({'message': 'Playlist deleted successfully.'}), 200


@api_bp.route('/playlists/<int:playlist_id>/songs', methods=['POST'])
@login_required
def add_song_to_playlist_route(playlist_id):
    data = request.get_json(silent=True) or {}
    song_id = data.get('song_id')
    url = data.get('url', '').strip()

    if not song_id and not url:
        return jsonify({'error': 'Either song_id or url must be provided.'}), 400

    if url and not song_id:
        video_id = extract_video_id(url)
        song = Song.query.filter_by(youtube_video_id=video_id).first()
        if not song:
            meta = fetch_youtube_metadata(video_id)
            title = data.get('title', '').strip() or meta.get('title') or f"YouTube Video ({video_id})"
            song = Song(
                youtube_video_id=video_id,
                title=title[:255],
                channel_name=(meta.get('channel_name') or 'YouTube')[:255],
                thumbnail_url=(meta.get('thumbnail_url') or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg")[:500]
            )
            db.session.add(song)
            db.session.flush()
        song_id = song.id

    # Ensure song exists
    song = db.session.get(Song, song_id)
    if not song:
        return jsonify({'error': 'Song not found.'}), 404

    # Ensure song is in user's library
    saved = SavedSong.query.filter_by(user_id=current_user.id, song_id=song.id).first()
    if not saved:
        saved = SavedSong(
            user_id=current_user.id,
            song_id=song.id,
            is_favorite=False,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(saved)
        db.session.flush()

    entry, created = add_song_to_playlist(playlist_id, song.id, current_user.id)

    msg = 'Song added to playlist.' if created else 'Song is already in this playlist.'
    status_code = 201 if created else 200
    return jsonify({
        'message': msg,
        'entry': entry.to_dict(),
        'already_in_playlist': not created
    }), status_code


@api_bp.route('/playlists/<int:playlist_id>/songs/<int:song_id>', methods=['DELETE'])
@login_required
def remove_song_from_playlist_route(playlist_id, song_id):
    removed = remove_song_from_playlist(playlist_id, song_id, current_user.id)
    if not removed:
        return jsonify({'error': 'Song not found in this playlist.'}), 404
    return jsonify({'message': 'Song removed from playlist.'}), 200


@api_bp.route('/playlists/<int:playlist_id>/order', methods=['PUT'])
@login_required
def reorder_playlist_route(playlist_id):
    data = request.get_json(silent=True) or {}
    song_ids = data.get('song_ids')

    if not isinstance(song_ids, list):
        return jsonify({'error': "Payload must contain a 'song_ids' list of song IDs."}), 400

    reorder_playlist_songs(playlist_id, song_ids, current_user.id)
    return jsonify({'message': 'Playlist order updated successfully.'}), 200


# -------------------------------------------------------------
# Listening History Endpoints
# -------------------------------------------------------------
@api_bp.route('/history', methods=['GET'])
@login_required
def get_history():
    history_entries = (
        ListeningHistory.query
        .join(Song, ListeningHistory.song_id == Song.id)
        .filter(ListeningHistory.user_id == current_user.id)
        .order_by(ListeningHistory.last_played_at.desc())
        .limit(50)
        .all()
    )
    return jsonify([h.to_dict() for h in history_entries]), 200


@api_bp.route('/history', methods=['POST'])
@login_required
def record_history():
    data = request.get_json(silent=True) or {}
    song_id = data.get('song_id')

    if not song_id:
        return jsonify({'error': 'song_id is required.'}), 400

    song = db.session.get(Song, song_id)
    if not song:
        return jsonify({'error': 'Song not found.'}), 404

    history_entry = ListeningHistory.query.filter_by(
        user_id=current_user.id,
        song_id=song_id
    ).first()

    now = datetime.now(timezone.utc)
    if history_entry:
        history_entry.last_played_at = now
    else:
        history_entry = ListeningHistory(
            user_id=current_user.id,
            song_id=song_id,
            last_played_at=now
        )
        db.session.add(history_entry)

    db.session.commit()
    return jsonify({
        'message': 'Playback history recorded.',
        'song_id': song_id,
        'last_played_at': history_entry.last_played_at.isoformat()
    }), 200


# -------------------------------------------------------------
# Audio Download & Streaming Endpoints
# -------------------------------------------------------------
@api_bp.route('/audio/<path:filename>', methods=['GET'])
def stream_audio(filename):
    """
    Serves downloaded audio with HTTP Range support for seamless browser seeking.
    """
    clean_name = os.path.basename(filename)
    audio_dir = get_audio_dir()
    return send_from_directory(audio_dir, clean_name, conditional=True, mimetype='audio/mpeg')


@api_bp.route('/songs/<int:song_id>/download', methods=['POST'])
@login_required
def download_existing_song_audio(song_id):
    """
    Triggers an on-demand download for an existing song.
    """
    song = db.session.get(Song, song_id)
    if not song:
        return jsonify({'error': 'Song not found.'}), 404

    res = download_youtube_audio(song.youtube_video_id)
    if not res.get('success'):
        return jsonify({'error': res.get('error', 'Download failed.')}), 500

    return jsonify({
        'message': 'Audio ready for local playback.',
        'song': song.to_dict()
    }), 200
