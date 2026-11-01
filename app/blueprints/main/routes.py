from flask import Blueprint, render_template, redirect, url_for
from flask_login import current_user, login_required
from app.models.playlist import Playlist

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    if not current_user.is_authenticated:
        return redirect(url_for('auth.login'))
    
    # Preload user playlists for initial sidebar render
    user_playlists = (
        Playlist.query
        .filter_by(user_id=current_user.id)
        .order_by(Playlist.updated_at.desc())
        .all()
    )
    return render_template('main/app.html', user=current_user, playlists=user_playlists)


@main_bp.route('/login')
def login_redirect():
    return redirect(url_for('auth.login'))


@main_bp.route('/register')
def register_redirect():
    return redirect(url_for('auth.register'))
