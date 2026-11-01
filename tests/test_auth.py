import pytest
from app.models.user import User
from tests.conftest import login_client


def test_register_success(client, app):
    response = client.post('/register' if False else '/auth/register', data={
        'name': 'Test User',
        'email': 'newuser@example.com',
        'password': 'password123',
        'confirm_password': 'password123'
    }, follow_redirects=True)

    assert response.status_code == 200
    with app.app_context():
        user = User.query.filter_by(email='newuser@example.com').first()
        assert user is not None
        assert user.name == 'Test User'
        assert user.check_password('password123')


def test_register_duplicate_email(client, user1):
    response = client.post('/auth/register', data={
        'name': 'Duplicate User',
        'email': 'USER1@example.com',  # Test case normalization
        'password': 'password123',
        'confirm_password': 'password123'
    }, follow_redirects=True)

    assert b"already exists" in response.data


def test_login_success(client, user1):
    response = login_client(client, email='user1@example.com', password='password123')
    assert response.status_code == 200
    assert b"Welcome back, User One!" in response.data


def test_login_invalid_password(client, user1):
    response = client.post('/auth/login', data={
        'email': 'user1@example.com',
        'password': 'wrongpassword'
    }, follow_redirects=True)

    assert response.status_code == 401
    assert b"Invalid email or password" in response.data


def test_logout(client, user1):
    login_client(client, email='user1@example.com', password='password123')
    response = client.post('/auth/logout', follow_redirects=True)
    assert response.status_code == 200
    assert b"logged out safely" in response.data


def test_unauthenticated_api_returns_401_json(client):
    response = client.get('/api/library')
    assert response.status_code == 401
    json_data = response.get_json()
    assert json_data['error'] == 'Unauthorized'


def test_forgot_password_page_loads(client):
    response = client.get('/auth/forgot-password')
    assert response.status_code == 200
    assert b"Forgot Password" in response.data


def test_forgot_password_3_step_flow(client, user1, app):
    # STEP 1: Enter email
    step1_resp = client.post('/auth/forgot-password', data={
        'email': 'user1@example.com'
    }, follow_redirects=True)
    assert step1_resp.status_code == 200
    assert b"Enter Verification Code" in step1_resp.data

    # Check that code was generated in session
    with client.session_transaction() as sess:
        code = sess.get('reset_code')
        assert code is not None
        assert len(code) == 6

    # STEP 2 (Negative): Enter incorrect code
    wrong_code_resp = client.post('/auth/verify-code', data={
        'code': '000000'
    }, follow_redirects=True)
    assert wrong_code_resp.status_code == 200
    assert b"Invalid verification code" in wrong_code_resp.data

    # STEP 2 (Positive): Enter correct code
    step2_resp = client.post('/auth/verify-code', data={
        'code': code
    }, follow_redirects=True)
    assert step2_resp.status_code == 200
    assert b"Set New Password" in step2_resp.data

    # STEP 3: Enter new password and confirm
    step3_resp = client.post('/auth/reset-password', data={
        'password': 'brandnewpassword999',
        'confirm_password': 'brandnewpassword999'
    }, follow_redirects=True)
    assert step3_resp.status_code == 200
    assert b"Your password has been changed successfully" in step3_resp.data

    # Verify password was updated in DB
    with app.app_context():
        user = User.query.filter_by(email='user1@example.com').first()
        assert user.check_password('brandnewpassword999')

    # Confirm login succeeds with new password
    login_resp = login_client(client, email='user1@example.com', password='brandnewpassword999')
    assert login_resp.status_code == 200
    assert b"Welcome back" in login_resp.data


def test_verify_code_unauthorized_direct_access(client):
    # Direct access to verify-code or reset-password without entering email should redirect
    resp = client.get('/auth/verify-code', follow_redirects=True)
    assert resp.status_code == 200
    assert b"Forgot Password" in resp.data

    resp2 = client.get('/auth/reset-password', follow_redirects=True)
    assert resp2.status_code == 200
    assert b"Forgot Password" in resp2.data


