import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'sak-music-default-insecure-key-replace-in-env')
    
    # Database
    instance_dir = BASE_DIR / 'instance'
    instance_dir.mkdir(parents=True, exist_ok=True)

    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        db_path = instance_dir / 'sak_music.db'
        db_url = f"sqlite:///{db_path.as_posix()}"
    elif db_url.startswith('sqlite:///') and not db_url.startswith('sqlite:///:memory:'):
        # Resolve relative SQLite path to absolute
        rel_path = db_url.replace('sqlite:///', '', 1)
        if not os.path.isabs(rel_path) and not (len(rel_path) > 1 and rel_path[1] == ':'):
            abs_db_path = (BASE_DIR / rel_path).resolve()
            abs_db_path.parent.mkdir(parents=True, exist_ok=True)
            db_url = f"sqlite:///{abs_db_path.as_posix()}"
    elif db_url.startswith('postgres://'):
        # Fix for Heroku/Render postgres:// prefix deprecated in SQLAlchemy
        db_url = db_url.replace('postgres://', 'postgresql://', 1)

    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
    }

    # Security & Cookies
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = None  # Prevents CSRF expiry during long music listening sessions
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'False').lower() in ('true', '1', 't')

    # Rate limiting
    RATELIMIT_DEFAULT = os.environ.get('RATELIMIT_DEFAULT', '300 per hour; 60 per minute')
    RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')
    RATELIMIT_STRATEGY = 'fixed-window'

    # External YouTube Service
    YOUTUBE_OEMBED_URL = 'https://www.youtube.com/oembed'
    HTTP_TIMEOUT = 5.0  # seconds

    # Email / SMTP Configuration (for password reset)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', '')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower() in ('true', '1', 't')
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', 'False').lower() in ('true', '1', 't')
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'Mayūra. <no-reply@sakmusic.local>')


class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = False


class TestingConfig(Config):
    DEBUG = False
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    RATELIMIT_ENABLED = False


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True


config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
