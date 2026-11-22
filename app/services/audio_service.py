import os
import logging
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

    ydl_opts = {
        'format': 'ba[ext=m4a]/ba/best',
        'outtmpl': output_template,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
    }

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
        logger.error(f"Error downloading audio for video {video_id}: {e}")
        return {
            'success': False,
            'error': str(e)
        }
