import os
from flask import Flask, render_template, jsonify, request, redirect, url_for, flash
from flask_wtf.csrf import CSRFError
from app.config import config_by_name, Config
from app.extensions import db, migrate, login_manager, csrf, limiter
from app.models.user import User


def create_app(config_name=None):
    """Application factory for Sak Music."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    app = Flask(__name__)

    if isinstance(config_name, str):
        app.config.from_object(config_by_name.get(config_name, config_by_name['default']))
    else:
        app.config.from_object(config_name)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)

    # Setup User loader
    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    # Unauthorized handler: API gets JSON 401, browser gets redirect
    @login_manager.unauthorized_handler
    def unauthorized():
        if request.path.startswith('/api/') or request.is_json:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'You must be logged in to access this resource.'
            }), 401
        flash('Please log in to access this page.', 'warning')
        return redirect(url_for('auth.login', next=request.full_path if request.method == 'GET' else None))

    # Error Handlers
    @app.errorhandler(404)
    def not_found_error(error):
        if request.path.startswith('/api/') or request.is_json:
            return jsonify({'error': 'Resource not found'}), 404
        return render_template('errors/404.html'), 404

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        if request.path.startswith('/api/') or request.is_json:
            return jsonify({'error': 'Internal server error'}), 500
        return render_template('errors/500.html'), 500

    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        if request.path.startswith('/api/') or request.is_json:
            return jsonify({'error': 'CSRF token missing or invalid', 'detail': e.description}), 400
        flash('Your session token expired. Please try submitting the form again.', 'error')
        return redirect(request.referrer or url_for('main.index'))

    @app.errorhandler(429)
    def ratelimit_handler(e):
        if request.path.startswith('/api/') or request.is_json:
            return jsonify({'error': 'Rate limit exceeded. Please wait a moment.'}), 429
        flash('Too many requests. Please slow down and try again shortly.', 'warning')
        return render_template('errors/429.html'), 429

    # Register blueprints
    from app.blueprints.auth import auth_bp
    from app.blueprints.main import main_bp
    from app.blueprints.api import api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    # Register CLI commands
    register_cli_commands(app)

    return app


def register_cli_commands(app: Flask):
    """Register custom CLI commands."""
    import click
    from datetime import datetime, timezone
    from app.models.song import Song
    from app.models.saved_song import SavedSong
    from app.models.playlist import Playlist
    from app.models.playlist_song import PlaylistSong

    @app.cli.command("seed-data")
    @click.option('--email', prompt='User email to seed playlists for', help='Email of existing user')
    def seed_data(email):
        """Seed sample playlists for a specified existing user."""
        email_clean = User.normalize_email(email)
        user = User.query.filter_by(email=email_clean).first()
        if not user:
            click.echo(f"Error: User with email '{email}' not found. Please register the user first.")
            return

        click.echo(f"Seeding sample playlists for user: {user.name} ({user.email})...")

        # Curated sample tracks (safe, official public music videos / lofi streams)
        sample_tracks = [
            {
                'id': 'jfKfPfyJRdk',
                'title': 'lofi hip hop radio - beats to relax/study to',
                'channel': 'Lofi Girl',
                'thumb': 'https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg'
            },
            {
                'id': '5qap5aO4i9A',
                'title': 'Lofi Hip Hop Chill Beats',
                'channel': 'ChilledCow / Lofi',
                'thumb': 'https://img.youtube.com/vi/5qap5aO4i9A/hqdefault.jpg'
            },
            {
                'id': 'DWcJFNfaw9c',
                'title': 'Khmer Acoustic Chill - Melodies of Cambodia',
                'channel': 'Sak Music Khmer Selection',
                'thumb': 'https://img.youtube.com/vi/DWcJFNfaw9c/hqdefault.jpg'
            },
            {
                'id': 'f02mOEt11OQ',
                'title': 'Chillhop Essentials - Atmospheric Sounds',
                'channel': 'Chillhop Music',
                'thumb': 'https://img.youtube.com/vi/f02mOEt11OQ/hqdefault.jpg'
            }
        ]

        # 1. Upsert songs & save to user library
        saved_song_objs = []
        for t in sample_tracks:
            song = Song.query.filter_by(youtube_video_id=t['id']).first()
            if not song:
                song = Song(
                    youtube_video_id=t['id'],
                    title=t['title'],
                    channel_name=t['channel'],
                    thumbnail_url=t['thumb']
                )
                db.session.add(song)
                db.session.flush()

            # Save in user library
            saved = SavedSong.query.filter_by(user_id=user.id, song_id=song.id).first()
            if not saved:
                saved = SavedSong(
                    user_id=user.id,
                    song_id=song.id,
                    is_favorite=True,
                    created_at=datetime.now(timezone.utc)
                )
                db.session.add(saved)
            saved_song_objs.append(song)

        db.session.commit()

        # 2. Create sample playlist 1: "Chill Vibes"
        p1 = Playlist.query.filter_by(user_id=user.id, name="[Sample] Chill Vibes").first()
        if not p1:
            p1 = Playlist(
                user_id=user.id,
                name="[Sample] Chill Vibes",
                description="A relaxing collection of lofi and acoustic melodies to study and unwind.",
                created_at=datetime.now(timezone.utc)
            )
            db.session.add(p1)
            db.session.flush()

            for idx, s in enumerate(saved_song_objs[:3]):
                ps = PlaylistSong(
                    playlist_id=p1.id,
                    song_id=s.id,
                    position=idx,
                    added_at=datetime.now(timezone.utc)
                )
                db.session.add(ps)

        # 3. Create sample playlist 2: "Top Hits"
        p2 = Playlist.query.filter_by(user_id=user.id, name="[Sample] Top Hits").first()
        if not p2:
            p2 = Playlist(
                user_id=user.id,
                name="[Sample] Top Hits",
                description="Handpicked popular favorites from YouTube.",
                created_at=datetime.now(timezone.utc)
            )
            db.session.add(p2)
            db.session.flush()

            for idx, s in enumerate(saved_song_objs[1:]):
                ps = PlaylistSong(
                    playlist_id=p2.id,
                    song_id=s.id,
                    position=idx,
                    added_at=datetime.now(timezone.utc)
                )
                db.session.add(ps)

        db.session.commit()
        click.echo("Successfully created sample playlists and added songs to user library!")
