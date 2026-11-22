from datetime import datetime, timezone
from app.extensions import db


class Song(db.Model):
    __tablename__ = 'songs'

    id = db.Column(db.Integer, primary_key=True)
    youtube_video_id = db.Column(db.String(32), unique=True, index=True, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    channel_name = db.Column(db.String(255), nullable=True)
    thumbnail_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    saved_instances = db.relationship('SavedSong', back_populates='song', cascade='all, delete-orphan')
    playlist_instances = db.relationship('PlaylistSong', back_populates='song', cascade='all, delete-orphan')
    history_instances = db.relationship('ListeningHistory', back_populates='song', cascade='all, delete-orphan')

    def to_dict(self):
        downloaded = False
        try:
            from app.services.audio_service import is_audio_downloaded
            downloaded = is_audio_downloaded(self.youtube_video_id)
        except Exception:
            downloaded = False

        return {
            'id': self.id,
            'youtube_video_id': self.youtube_video_id,
            'title': self.title,
            'channel_name': self.channel_name or '',
            'thumbnail_url': self.thumbnail_url or f"https://img.youtube.com/vi/{self.youtube_video_id}/hqdefault.jpg",
            'audio_url': f"/api/audio/{self.youtube_video_id}.mp3" if downloaded else None,
            'is_downloaded': downloaded,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<Song {self.youtube_video_id}: {self.title[:30]}>'
