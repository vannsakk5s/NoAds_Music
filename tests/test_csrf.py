from app import create_app
from app.config import Config
from app.extensions import db
from app.models.user import User


class CsrfEnabledTestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = True
    RATELIMIT_ENABLED = False


def test_csrf_protection_blocks_post_without_token():
    app = create_app(CsrfEnabledTestingConfig)
    with app.app_context():
        db.create_all()
        client = app.test_client()

        # Attempt to post register form without csrf token
        res = client.post('/auth/register', data={
            'name': 'CSRF Attacker',
            'email': 'attack@example.com',
            'password': 'password123',
            'confirm_password': 'password123'
        })
        # Flask-WTF with validate_on_submit fails validation when CSRF token is missing
        # and re-renders form with error or redirects
        assert User.query.filter_by(email='attack@example.com').first() is None

        # For JSON API with CSRF protect:
        api_res = client.post('/api/library', json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})
        # Should be rejected with 400 CSRF token missing or 401
        assert api_res.status_code in (400, 401)
