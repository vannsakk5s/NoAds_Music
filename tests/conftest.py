import pytest
from app import create_app
from app.config import TestingConfig
from app.extensions import db
from app.models.user import User


class ExtendedTestingConfig(TestingConfig):
    WTF_CSRF_ENABLED = False  # Disabled by default for direct test calls; enabled in specific CSRF tests
    RATELIMIT_ENABLED = False


@pytest.fixture
def app():
    app = create_app(ExtendedTestingConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def user1(app):
    with app.app_context():
        user = User(name="User One", email="user1@example.com")
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        return User.query.filter_by(email="user1@example.com").first()


@pytest.fixture
def user2(app):
    with app.app_context():
        user = User(name="User Two", email="user2@example.com")
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        return User.query.filter_by(email="user2@example.com").first()


def login_client(client, email="user1@example.com", password="password123"):
    client.post('/auth/logout', follow_redirects=True)
    return client.post('/auth/login', data={
        'email': email,
        'password': password
    }, follow_redirects=True)
