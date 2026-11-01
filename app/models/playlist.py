from datetime import datetime, timezone
from app.extensions import db


class Playlist(db.Model):
    __tablename__ = 'playlists'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = db.relationship('User', back_populates='playlists')
    playlist_songs = db.relationship(
        'PlaylistSong',
        back_populates='playlist',
        cascade='all, delete-orphan',
        order_by='PlaylistSong.position'
    )

    def to_dict(self, include_songs=False):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description or '',
            'song_count': len(self.playlist_songs),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_songs:
            data['songs'] = [ps.to_dict() for ps in self.playlist_songs]
        return data

    def __repr__(self):
        return f'<Playlist {self.id}: {self.name}>'
