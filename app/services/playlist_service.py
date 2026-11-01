from typing import List, Tuple, Optional
from datetime import datetime, timezone
from app.extensions import db
from app.models.song import Song
from app.models.playlist import Playlist
from app.models.playlist_song import PlaylistSong
from app.models.saved_song import SavedSong
from app.models.listening_history import ListeningHistory
from app.services.youtube_service import fetch_youtube_playlist_info, YouTubeValidationError


class PlaylistError(Exception):
    pass


def get_user_playlist(playlist_id: int, user_id: int) -> Playlist:
    """Retrieve a playlist ensuring it belongs to the authenticated user."""
    playlist = Playlist.query.filter_by(id=playlist_id, user_id=user_id).first()
    if not playlist:
        raise PlaylistError("Playlist not found or you do not have permission to access it.")
    return playlist


def add_song_to_playlist(playlist_id: int, song_id: int, user_id: int) -> Tuple[PlaylistSong, bool]:
    """
    Adds a song to a playlist at the end of the deterministic sequence.
    Returns (PlaylistSong, created).
    """
    playlist = get_user_playlist(playlist_id, user_id)

    # Check for existing entry
    existing = PlaylistSong.query.filter_by(playlist_id=playlist.id, song_id=song_id).first()
    if existing:
        return existing, False

    # Get current maximum position
    max_pos = db.session.query(db.func.max(PlaylistSong.position)).filter_by(playlist_id=playlist.id).scalar()
    next_pos = 0 if max_pos is None else max_pos + 1

    entry = PlaylistSong(
        playlist_id=playlist.id,
        song_id=song_id,
        position=next_pos,
        added_at=datetime.now(timezone.utc)
    )
    playlist.updated_at = datetime.now(timezone.utc)
    db.session.add(entry)
    db.session.commit()
    return entry, True


def remove_song_from_playlist(playlist_id: int, song_id: int, user_id: int) -> bool:
    """
    Removes a song from a specific playlist and recalculates contiguous positions.
    """
    playlist = get_user_playlist(playlist_id, user_id)

    target_entry = PlaylistSong.query.filter_by(playlist_id=playlist.id, song_id=song_id).first()
    if not target_entry:
        return False

    db.session.delete(target_entry)
    db.session.flush()

    # Re-index remaining songs to maintain contiguous 0..N-1 positions
    remaining = (
        PlaylistSong.query
        .filter_by(playlist_id=playlist.id)
        .order_by(PlaylistSong.position.asc(), PlaylistSong.added_at.asc())
        .all()
    )
    for idx, item in enumerate(remaining):
        item.position = idx

    playlist.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return True


def reorder_playlist_songs(playlist_id: int, ordered_song_ids: List[int], user_id: int) -> bool:
    """
    Transactionally reorders songs within a playlist based on a provided list of song IDs.
    Validates that the provided IDs match the exact set of current playlist song IDs.
    """
    playlist = get_user_playlist(playlist_id, user_id)

    current_entries = PlaylistSong.query.filter_by(playlist_id=playlist.id).all()
    current_song_ids = {entry.song_id for entry in current_entries}

    if len(ordered_song_ids) != len(current_entries):
        raise PlaylistError("Provided song list count does not match current playlist count.")

    if set(ordered_song_ids) != current_song_ids:
        raise PlaylistError("Provided song list must match the exact songs in the playlist without duplicates.")

    # Build mapping from song_id to entry
    entry_map = {entry.song_id: entry for entry in current_entries}

    # Step 1: Temporarily set positions to negative to avoid transient unique index conflicts if any
    for idx, sid in enumerate(ordered_song_ids):
        entry_map[sid].position = -(idx + 1)
    db.session.flush()

    # Step 2: Set target positions 0..N-1
    for idx, sid in enumerate(ordered_song_ids):
        entry_map[sid].position = idx

    playlist.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return True


def remove_song_from_user_library(user_id: int, song_id: int) -> bool:
    """
    Removes a song from user's personal library.
    Also removes it from that user's playlists and listening history,
    while leaving other users' data and the shared Song catalog intact.
    """
    saved = SavedSong.query.filter_by(user_id=user_id, song_id=song_id).first()
    if not saved:
        return False

    # 1. Remove from saved library
    db.session.delete(saved)

    # 2. Remove from all playlists belonging to this user
    user_playlist_ids = [p.id for p in Playlist.query.filter_by(user_id=user_id).all()]
    if user_playlist_ids:
        affected_entries = (
            PlaylistSong.query
            .filter(PlaylistSong.playlist_id.in_(user_playlist_ids), PlaylistSong.song_id == song_id)
            .all()
        )
        affected_playlist_ids = {entry.playlist_id for entry in affected_entries}

        for entry in affected_entries:
            db.session.delete(entry)
        db.session.flush()

        # Re-index affected playlists
        for pid in affected_playlist_ids:
            remaining = (
                PlaylistSong.query
                .filter_by(playlist_id=pid)
                .order_by(PlaylistSong.position.asc(), PlaylistSong.added_at.asc())
                .all()
            )
            for idx, item in enumerate(remaining):
                item.position = idx

    # 3. Remove from user's listening history
    ListeningHistory.query.filter_by(user_id=user_id, song_id=song_id).delete()

    db.session.commit()
    return True


def create_playlist_from_youtube(
    user_id: int,
    url: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    target_playlist_id: Optional[int] = None,
    max_songs: int = 150
) -> Tuple[Playlist, int, List[str]]:
    """
    Imports a playlist from a YouTube playlist URL.
    - If target_playlist_id is provided, appends the songs to that user playlist.
    - Otherwise, creates a new playlist for the user.
    - Adds every song to the shared Song catalog and the user's SavedSong library.
    - Returns (playlist, count_of_songs_added, list_of_video_ids_added).
    """
    info = fetch_youtube_playlist_info(url, max_songs=max_songs)
    extracted_songs = info.get('songs') or []
    if not extracted_songs:
        raise PlaylistError("No valid songs found in the specified YouTube playlist.")

    if target_playlist_id:
        playlist = get_user_playlist(target_playlist_id, user_id)
        if name:
            playlist.name = name.strip()[:150]
        if description is not None:
            playlist.description = description.strip()
    else:
        pl_name = (name or info.get('title') or 'YouTube Playlist').strip()[:150]
        pl_desc = (description if description is not None else info.get('description') or '').strip()
        playlist = Playlist(
            user_id=user_id,
            name=pl_name,
            description=pl_desc,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.session.add(playlist)
        db.session.flush()

    # Get current max position for deterministic sequence
    max_pos = db.session.query(db.func.max(PlaylistSong.position)).filter_by(playlist_id=playlist.id).scalar()
    current_pos = 0 if max_pos is None else max_pos + 1

    # Existing song IDs in playlist
    existing_song_ids = {
        ps.song_id for ps in PlaylistSong.query.filter_by(playlist_id=playlist.id).all()
    }

    added_count = 0
    added_video_ids = []

    for item in extracted_songs:
        vid_id = item['video_id']
        title = item.get('title') or f"Video {vid_id}"
        channel = item.get('channel_name') or 'YouTube Creator'
        thumb = item.get('thumbnail_url') or f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"

        # 1. Catalog Song
        song = Song.query.filter_by(youtube_video_id=vid_id).first()
        if not song:
            song = Song(
                youtube_video_id=vid_id,
                title=title[:255],
                channel_name=channel[:255],
                thumbnail_url=thumb[:500]
            )
            db.session.add(song)
            db.session.flush()

        # 2. User library
        saved = SavedSong.query.filter_by(user_id=user_id, song_id=song.id).first()
        if not saved:
            saved = SavedSong(
                user_id=user_id,
                song_id=song.id,
                is_favorite=False,
                created_at=datetime.now(timezone.utc)
            )
            db.session.add(saved)
            db.session.flush()

        # 3. PlaylistSong
        if song.id not in existing_song_ids:
            ps = PlaylistSong(
                playlist_id=playlist.id,
                song_id=song.id,
                position=current_pos,
                added_at=datetime.now(timezone.utc)
            )
            db.session.add(ps)
            existing_song_ids.add(song.id)
            current_pos += 1
            added_count += 1
            added_video_ids.append(vid_id)

    playlist.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return playlist, added_count, added_video_ids

