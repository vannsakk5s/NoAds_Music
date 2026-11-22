import os
import logging
from typing import Optional, Dict, Any
from flask import current_app

logger = logging.getLogger(__name__)


def get_audio_dir() -> str:
    """Returns the absolute path to the audio storage directory in the instance folder."""
    audio_dir = os.path.join(current_app.instance_path, 'audio')
    os.makedirs(audio_dir, exist_ok=True)
    return audio_dir


def get_audio_file_path(video_id: str) -> str:
    """Returns the absolute path for a given YouTube video ID's MP3 file."""
    return os.path.join(get_audio_dir(), f"{video_id}.mp3")


def is_audio_downloaded(video_id: str) -> bool:
    """Checks whether the MP3 for the given video ID has already been downloaded."""
    path = get_audio_file_path(video_id)
    return os.path.isfile(path) and os.path.getsize(path) > 1024


def get_cookie_file_path() -> Optional[str]:
    """
    Finds a valid cookies.txt file for yt-dlp to authenticate requests and bypass anti-bot challenges.
    Checks:
      1. Flask config 'YTDLP_COOKIE_FILE' or env var 'YTDLP_COOKIE_FILE' / 'YOUTUBE_COOKIE_FILE'
      2. instance/cookies.txt
      3. cookies.txt in the application root directory
    """
    configured = None
    try:
        if current_app:
            configured = current_app.config.get('YTDLP_COOKIE_FILE')
    except RuntimeError:
        pass

    if not configured:
        configured = os.getenv('YTDLP_COOKIE_FILE') or os.getenv('YOUTUBE_COOKIE_FILE')

    if configured:
        if os.path.isabs(configured) and os.path.isfile(configured):
            return configured
        try:
            if current_app:
                cand_instance = os.path.join(current_app.instance_path, configured)
                if os.path.isfile(cand_instance):
                    return cand_instance
                cand_root = os.path.join(current_app.root_path, '..', configured)
                if os.path.isfile(cand_root):
                    return os.path.abspath(cand_root)
        except RuntimeError:
            pass
        if os.path.isfile(configured):
            return os.path.abspath(configured)

    # Check default instance/cookies.txt
    try:
        if current_app:
            instance_cookie = os.path.join(current_app.instance_path, 'cookies.txt')
            if os.path.isfile(instance_cookie) and os.path.getsize(instance_cookie) > 0:
                return instance_cookie
            root_cookie = os.path.abspath(os.path.join(current_app.root_path, '..', 'cookies.txt'))
            if os.path.isfile(root_cookie) and os.path.getsize(root_cookie) > 0:
                return root_cookie
    except RuntimeError:
        pass

    cwd_cookie = os.path.abspath('cookies.txt')
    if os.path.isfile(cwd_cookie) and os.path.getsize(cwd_cookie) > 0:
        return cwd_cookie

    return None


def get_ytdlp_base_opts() -> Dict[str, Any]:
    """
    Builds the default base options dictionary for yt-dlp, configuring cookies,
    extractor args (player clients), and proxies if available.
    """
    opts: Dict[str, Any] = {
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'retries': 3,
        'extractor_args': {
            'youtube': {
                'player_client': ['tv_samsung', 'ios', 'android', 'mweb', 'web']
            }
        }
    }

    # Cookie file support to bypass bot detection on datacenter / cloud IPs
    cookie_file = get_cookie_file_path()
    if cookie_file:
        logger.info(f"Using cookies file for yt-dlp: {cookie_file}")
        opts['cookiefile'] = cookie_file
    else:
        # Check if browser cookies are requested for local dev
        cookies_browser = None
        try:
            if current_app:
                cookies_browser = current_app.config.get('YTDLP_COOKIES_FROM_BROWSER')
        except RuntimeError:
            pass
        if not cookies_browser:
            cookies_browser = os.getenv('YTDLP_COOKIES_FROM_BROWSER')

        if cookies_browser:
            opts['cookiesfrombrowser'] = (cookies_browser,)

    # Proxy support (useful when cloud hosting IP is rate-limited or blocked)
    proxy = None
    try:
        if current_app:
            proxy = current_app.config.get('YTDLP_PROXY')
    except RuntimeError:
        pass
    if not proxy:
        proxy = os.getenv('YTDLP_PROXY') or os.getenv('YOUTUBE_PROXY')

    if proxy:
        opts['proxy'] = proxy

    return opts


def download_youtube_audio(video_id: str) -> dict:
    """
    Downloads the audio stream for a YouTube video using yt-dlp and extracts it to MP3.
    Returns a dictionary with status, video_id, and filename.
    """
    if is_audio_downloaded(video_id):
        return {
            'success': True,
            'video_id': video_id,
            'file_name': f"{video_id}.mp3",
            'already_cached': True
        }

    try:
        import yt_dlp
    except ImportError:
        logger.error("yt-dlp is not installed in the Python environment.")
        return {'success': False, 'error': 'yt-dlp is not installed on the server.'}

    audio_dir = get_audio_dir()
    output_template = os.path.join(audio_dir, f"{video_id}.%(ext)s")

    ydl_opts = get_ytdlp_base_opts()
    ydl_opts.update({
        'format': 'ba[ext=m4a]/ba/best',
        'outtmpl': output_template,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    })

    url = f"https://www.youtube.com/watch?v={video_id}"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        if is_audio_downloaded(video_id):
            return {
                'success': True,
                'video_id': video_id,
                'file_name': f"{video_id}.mp3",
                'already_cached': False
            }
        else:
            return {
                'success': False,
                'error': 'Download finished but audio file was not created.'
            }
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error downloading audio for video {video_id}: {error_msg}")

        # Human-friendly guidance if YouTube blocks datacenter/VPS IP
        if "Sign in to confirm you're not a bot" in error_msg or "confirm you're not a bot" in error_msg.lower():
            friendly_error = (
                "YouTube anti-bot verification triggered. "
                "Please add a YouTube 'cookies.txt' file in instance/cookies.txt on the server."
            )
            return {'success': False, 'error': friendly_error}

        return {
            'success': False,
            'error': error_msg
        }
