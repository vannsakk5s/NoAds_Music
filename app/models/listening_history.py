from datetime import datetime, timezone
from app.extensions import db


class ListeningHistory(db.Model):
    __tablename__ = 'listening_history'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    song_id = db.Column(db.Integer, db.ForeignKey('songs.id', ondelete='CASCADE'), nullable=False, index=True)
    last_played_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'song_id', name='uq_user_history_song'),
    )

    # Relationships
    user = db.relationship('User', back_populates='listening_history')
    song = db.relationship('Song', back_populates='history_instances')

    def to_dict(self):
        data = self.song.to_dict() if self.song else {}
        data['history_id'] = self.id
        data['last_played_at'] = self.last_played_at.isoformat() if self.last_played_at else None
        return data

    def __repr__(self):
        return f'<ListeningHistory User={self.user_id} Song={self.song_id} At={self.last_played_at}>'
