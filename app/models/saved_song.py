from datetime import datetime, timezone
from app.extensions import db


class SavedSong(db.Model):
    __tablename__ = 'saved_songs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    song_id = db.Column(db.Integer, db.ForeignKey('songs.id', ondelete='CASCADE'), nullable=False, index=True)
    is_favorite = db.Column(db.Boolean, default=False, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'song_id', name='uq_user_song'),
    )

    # Relationships
    user = db.relationship('User', back_populates='saved_songs')
    song = db.relationship('Song', back_populates='saved_instances')

    def to_dict(self):
        data = self.song.to_dict() if self.song else {}
        data['library_id'] = self.id
        data['is_favorite'] = self.is_favorite
        data['saved_at'] = self.created_at.isoformat() if self.created_at else None
        return data

    def __repr__(self):
        return f'<SavedSong User={self.user_id} Song={self.song_id} Fav={self.is_favorite}>'
