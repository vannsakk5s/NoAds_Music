from datetime import datetime, timezone
from app.extensions import db


class PlaylistSong(db.Model):
    __tablename__ = 'playlist_songs'

    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey('playlists.id', ondelete='CASCADE'), nullable=False, index=True)
    song_id = db.Column(db.Integer, db.ForeignKey('songs.id', ondelete='CASCADE'), nullable=False, index=True)
    position = db.Column(db.Integer, nullable=False)
    added_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        db.UniqueConstraint('playlist_id', 'song_id', name='uq_playlist_song'),
    )

    # Relationships
    playlist = db.relationship('Playlist', back_populates='playlist_songs')
    song = db.relationship('Song', back_populates='playlist_instances')

    def to_dict(self):
        data = self.song.to_dict() if self.song else {}
        data['playlist_song_id'] = self.id
        data['playlist_id'] = self.playlist_id
        data['position'] = self.position
        data['added_at'] = self.added_at.isoformat() if self.added_at else None
        return data

    def __repr__(self):
        return f'<PlaylistSong Playlist={self.playlist_id} Song={self.song_id} Pos={self.position}>'
