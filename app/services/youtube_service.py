import re
import urllib.parse
import requests
from typing import Optional, Dict, Any, Tuple

VIDEO_ID_REGEX = re.compile(r'^[a-zA-Z0-9_-]{11}$')
PLAYLIST_ID_REGEX = re.compile(r'^[a-zA-Z0-9_-]{10,64}$')

ALLOWED_HOSTS = {
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
    'www.youtu.be'
}


class YouTubeValidationError(Exception):
    """Raised when a submitted URL is invalid or unsupported."""
    pass


def extract_video_id(url_str: str) -> str:
    """
    Extracts and validates a YouTube video ID from various supported URL formats.
    
    Supported formats:
      - https://www.youtube.com/watch?v=VIDEO_ID
      - https://youtu.be/VIDEO_ID
      - https://www.youtube.com/shorts/VIDEO_ID
      - https://www.youtube.com/live/VIDEO_ID
      - https://www.youtube.com/embed/VIDEO_ID
      - https://music.youtube.com/watch?v=VIDEO_ID
    
    Extra query parameters (like ?t=... or &list=...) are handled and ignored.
    Playlist-only URLs or unrelated domains are rejected.
    """
    if not url_str or not isinstance(url_str, str):
        raise YouTubeValidationError("Please provide a valid YouTube URL.")

    url_str = url_str.strip()
    if not url_str.startswith(('http://', 'https://')):
        url_str = 'https://' + url_str

    try:
        parsed = urllib.parse.urlparse(url_str)
    except Exception:
        raise YouTubeValidationError("Invalid URL format.")

    hostname = (parsed.hostname or '').lower()
    if hostname.startswith('www.'):
        clean_host = hostname[4:]
    else:
        clean_host = hostname

    if hostname not in ALLOWED_HOSTS and clean_host not in ALLOWED_HOSTS:
        raise YouTubeValidationError(
            f"Unsupported domain '{hostname}'. Only official YouTube URLs are accepted."
        )

    path = parsed.path or ''
    video_id: Optional[str] = None

    # Handle youtu.be/VIDEO_ID
    if 'youtu.be' in hostname:
        parts = [p for p in path.strip('/').split('/') if p]
        if parts:
            video_id = parts[0]
        else:
            raise YouTubeValidationError("No video ID found in youtu.be link.")

    # Handle youtube.com and music.youtube.com
    else:
        # Check if it is a playlist-only link
        if path.rstrip('/') == '/playlist':
            raise YouTubeValidationError(
                "Playlist URLs are not supported directly. Please provide a link to an individual video."
            )

        query_params = urllib.parse.parse_qs(parsed.query)

        if path.rstrip('/') == '/watch':
            if 'v' in query_params and query_params['v']:
                video_id = query_params['v'][0]
            else:
                raise YouTubeValidationError("Missing 'v' video parameter in watch URL.")
        elif path.startswith('/shorts/'):
            parts = [p for p in path.split('/shorts/')[1].split('/') if p]
            if parts:
                video_id = parts[0]
        elif path.startswith('/live/'):
            parts = [p for p in path.split('/live/')[1].split('/') if p]
            if parts:
                video_id = parts[0]
        elif path.startswith('/embed/'):
            parts = [p for p in path.split('/embed/')[1].split('/') if p]
            if parts:
                video_id = parts[0]
        else:
            # Fallback check for ?v= in query regardless of path
            if 'v' in query_params and query_params['v']:
                video_id = query_params['v'][0]

    if not video_id:
        raise YouTubeValidationError("Could not extract a valid YouTube video ID from the provided link.")

    # Validate exact 11-character video ID
    video_id = video_id.strip()
    if not VIDEO_ID_REGEX.match(video_id):
        raise YouTubeValidationError(
            f"Invalid YouTube video ID '{video_id}'. YouTube video IDs must be exactly 11 characters."
        )

    return video_id


def fetch_youtube_metadata(video_id: str, timeout: float = 5.0) -> Dict[str, Any]:
    """
    Fetches title, channel name, and thumbnail metadata from YouTube's official oEmbed endpoint.
    
    Strict SSRF protection:
      - Validates video_id regex first.
      - Never fetches arbitrary URLs; only queries the fixed official oEmbed endpoint.
      - Disallows arbitrary redirects.
      - Enforces strict timeout.
    """
    if not VIDEO_ID_REGEX.match(video_id):
        raise YouTubeValidationError("Invalid video ID format for metadata request.")

    # Fixed safe endpoint URL
    oembed_url = (
        f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    )

    default_thumbnail = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

    try:
        response = requests.get(
            oembed_url,
            timeout=timeout,
            allow_redirects=False,
            headers={'User-Agent': 'SakMusic/1.0'}
        )

        if response.status_code == 200:
            data = response.json()
            title = data.get('title') or f"YouTube Video ({video_id})"
            author_name = data.get('author_name') or 'YouTube Creator'
            thumbnail = data.get('thumbnail_url') or default_thumbnail

            return {
                'success': True,
                'video_id': video_id,
                'title': title,
                'channel_name': author_name,
                'thumbnail_url': thumbnail,
                'note': 'Metadata retrieved successfully. Embedding permissions depend on YouTube video settings.'
            }
        elif response.status_code in (401, 403):
            # Video is private or embedding is restricted by owner
            return {
                'success': False,
                'video_id': video_id,
                'title': f"YouTube Video ({video_id})",
                'channel_name': 'Unknown Creator',
                'thumbnail_url': default_thumbnail,
                'note': 'Video may be private or restricted by author. You can still set a title manually.'
            }
        elif response.status_code == 404:
            return {
                'success': False,
                'video_id': video_id,
                'title': f"YouTube Video ({video_id})",
                'channel_name': 'Unknown Creator',
                'thumbnail_url': default_thumbnail,
                'note': 'Video not found or removed on YouTube. You can still save it with a manual title.'
            }
        else:
            return {
                'success': False,
                'video_id': video_id,
                'title': f"YouTube Video ({video_id})",
                'channel_name': 'YouTube Video',
                'thumbnail_url': default_thumbnail,
                'note': 'Could not fetch metadata from YouTube oEmbed. You can specify the title manually.'
            }
    except requests.RequestException:
        # Network error, timeout, or DNS failure
        return {
            'success': False,
            'video_id': video_id,
            'title': f"YouTube Video ({video_id})",
            'channel_name': 'YouTube Video',
            'thumbnail_url': default_thumbnail,
            'note': 'Network timeout reaching YouTube oEmbed service. Title can be provided manually.'
        }


def is_playlist_url(url_str: str) -> bool:
    """Checks whether a given URL string points to a YouTube playlist."""
    if not url_str or not isinstance(url_str, str):
        return False
    try:
        extract_playlist_id(url_str)
        return True
    except YouTubeValidationError:
        return False


def extract_playlist_id(url_str: str) -> str:
    """
    Extracts and validates a YouTube playlist ID from various supported URL formats:
      - https://www.youtube.com/playlist?list=PLAYLIST_ID
      - https://youtube.com/playlist?list=PLAYLIST_ID
      - https://music.youtube.com/playlist?list=PLAYLIST_ID
      - https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID
      - https://youtu.be/VIDEO_ID?list=PLAYLIST_ID
      - Direct playlist ID (e.g., PLB67v-2te-VE)
    """
    if not url_str or not isinstance(url_str, str):
        raise YouTubeValidationError("Please provide a valid YouTube playlist URL.")

    url_str = url_str.strip()

    # Raw playlist ID provided directly without URL protocol or path
    if PLAYLIST_ID_REGEX.match(url_str) and not url_str.startswith(('http://', 'https://', '/')) and '/' not in url_str:
        return url_str

    if not url_str.startswith(('http://', 'https://')):
        url_str = 'https://' + url_str

    try:
        parsed = urllib.parse.urlparse(url_str)
    except Exception:
        raise YouTubeValidationError("Invalid URL format.")

    hostname = (parsed.hostname or '').lower()
    clean_host = hostname[4:] if hostname.startswith('www.') else hostname

    if hostname not in ALLOWED_HOSTS and clean_host not in ALLOWED_HOSTS:
        raise YouTubeValidationError(
            f"Unsupported domain '{hostname}'. Only official YouTube URLs are accepted."
        )

    query_params = urllib.parse.parse_qs(parsed.query)
    playlist_id: Optional[str] = None

    if 'list' in query_params and query_params['list']:
        playlist_id = query_params['list'][0]
    else:
        path = parsed.path or ''
        parts = [p for p in path.strip('/').split('/') if p]
        if len(parts) >= 2 and parts[0] == 'playlist':
            playlist_id = parts[1]

    if not playlist_id:
        raise YouTubeValidationError("No playlist ID ('list=...') found in the provided YouTube link.")

    playlist_id = playlist_id.strip()
    if not PLAYLIST_ID_REGEX.match(playlist_id):
        raise YouTubeValidationError(f"Invalid YouTube playlist ID '{playlist_id}'.")

    return playlist_id


def fetch_youtube_playlist_info(url_or_id: str, max_songs: int = 150) -> Dict[str, Any]:
    """
    Extracts playlist metadata and list of videos using yt-dlp flat extraction.
    Does not download media files, making this fast and lightweight.
    """
    playlist_id = extract_playlist_id(url_or_id)
    canonical_url = f"https://www.youtube.com/playlist?list={playlist_id}"

    try:
        import yt_dlp
    except ImportError:
        raise YouTubeValidationError("yt-dlp is not installed on the server.")

    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'playlist_items': f"1-{max_songs}",
        'retries': 0,
        'socket_timeout': 10,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(canonical_url, download=False)
    except Exception as e:
        raise YouTubeValidationError(f"Could not load playlist from YouTube: {str(e)}")

    if not info:
        raise YouTubeValidationError("Playlist not found or is private.")

    raw_entries = info.get('entries') or []
    songs = []
    seen_ids = set()

    for entry in raw_entries:
        if not entry:
            continue
        vid_id = entry.get('id')
        if not vid_id or not VIDEO_ID_REGEX.match(vid_id):
            continue
        if vid_id in seen_ids:
            continue
        seen_ids.add(vid_id)

        title = (entry.get('title') or f"Video {vid_id}").strip()
        channel = (entry.get('uploader') or entry.get('channel') or 'YouTube Creator').strip()

        thumb = f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"
        thumbs = entry.get('thumbnails') or []
        if thumbs and isinstance(thumbs, list):
            for t in reversed(thumbs):
                if isinstance(t, dict) and t.get('url'):
                    thumb = t['url']
                    break

        songs.append({
            'video_id': vid_id,
            'title': title,
            'channel_name': channel,
            'thumbnail_url': thumb
        })

    title = (info.get('title') or f"YouTube Playlist ({playlist_id})").strip()
    channel = (info.get('uploader') or info.get('channel') or '').strip()
    description = (info.get('description') or '').strip()
    first_thumb = songs[0]['thumbnail_url'] if songs else None

    return {
        'success': True,
        'playlist_id': playlist_id,
        'title': title,
        'channel_name': channel,
        'description': description,
        'song_count': len(songs),
        'thumbnail_url': first_thumb,
        'songs': songs
    }

