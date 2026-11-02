import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import urlsplit
from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app, session
from flask_login import login_user, logout_user, current_user, login_required
from app.extensions import db, limiter
from app.models.user import User
from app.blueprints.auth.forms import (
    LoginForm,
    RegisterForm,
    ForgotPasswordEmailForm,
    VerifyCodeForm,
    ResetPasswordForm
)
from app.services.email_service import send_password_reset_code

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')


def is_safe_url(target: str) -> bool:
    """Validate that the target URL is a safe relative redirect target to prevent open redirects."""
    if not target:
        return False
    if target.startswith('//') or target.startswith(r'\\'):
        return False
    ref_url = urlsplit(request.host_url)
    test_url = urlsplit(target)
    return test_url.scheme in ('', 'http', 'https') and (not test_url.netloc or test_url.netloc == ref_url.netloc)


@auth_bp.route('/login', methods=['GET', 'POST'])
@limiter.limit("15 per minute", methods=["POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    form = LoginForm()
    if form.validate_on_submit():
        normalized_email = User.normalize_email(form.email.data)
        user = User.query.filter_by(email=normalized_email).first()

        # Generic invalid-login message to prevent account enumeration
        if user is None or not user.check_password(form.password.data):
            flash('Invalid email or password. Please try again.', 'error')
            return render_template('auth/login.html', form=form), 401

        login_user(user, remember=form.remember.data)
        flash(f'Welcome back, {user.name}!', 'success')

        next_page = request.args.get('next')
        if next_page and is_safe_url(next_page):
            return redirect(next_page)
        return redirect(url_for('main.index'))

    return render_template('auth/login.html', form=form)


@auth_bp.route('/register', methods=['GET', 'POST'])
@limiter.limit("10 per minute", methods=["POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    form = RegisterForm()
    if form.validate_on_submit():
        normalized_email = User.normalize_email(form.email.data)
        user = User(
            name=form.name.data.strip(),
            email=normalized_email
        )
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()

        login_user(user)
        flash('Registration successful! Welcome to Mayūra.', 'success')
        return redirect(url_for('main.index'))

    return render_template('auth/register.html', form=form)


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    flash('You have been logged out safely.', 'info')
    return redirect(url_for('auth.login'))


@auth_bp.route('/forgot-password', methods=['GET', 'POST'])
@limiter.limit("6 per minute", methods=["POST"])
def forgot_password():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    form = ForgotPasswordEmailForm()

    if form.validate_on_submit():
        normalized_email = User.normalize_email(form.email.data)
        user = User.query.filter_by(email=normalized_email).first()

        if user:
            # Generate secure 6-digit numeric verification code
            code = f"{secrets.randbelow(900000) + 100000}"
            session['reset_email'] = user.email
            session['reset_code'] = code
            session['reset_code_expires'] = (datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp()
            session['reset_verified'] = False

            email_sent = send_password_reset_code(user.email, code)
            if not email_sent:
                session['dev_code'] = code
                flash('Verification code generated! (SMTP not configured, see notice)', 'info')
            else:
                session.pop('dev_code', None)
                flash(f'A 6-digit verification code has been sent to {user.email}.', 'success')

            return redirect(url_for('auth.verify_code'))
        else:
            flash('No account found with this email address.', 'error')

    return render_template('auth/forgot_password.html', form=form)


@auth_bp.route('/verify-code', methods=['GET', 'POST'])
@limiter.limit("10 per minute", methods=["POST"])
def verify_code():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    email = session.get('reset_email')
    expected_code = session.get('reset_code')

    if not email or not expected_code:
        flash('Please enter your email to request a verification code.', 'info')
        return redirect(url_for('auth.forgot_password'))

    form = VerifyCodeForm()
    dev_code = session.get('dev_code')

    if form.validate_on_submit():
        expires = session.get('reset_code_expires', 0)
        if datetime.now(timezone.utc).timestamp() > expires:
            flash('Your verification code has expired. Please request a new one.', 'error')
            return redirect(url_for('auth.forgot_password'))

        entered_code = form.code.data.strip()
        if entered_code != expected_code:
            flash('Invalid verification code. Please check your email and try again.', 'error')
            return render_template('auth/verify_code.html', form=form, email=email, dev_code=dev_code)

        # Code matched successfully
        session['reset_verified'] = True
        session.pop('reset_code', None)
        session.pop('dev_code', None)
        flash('Code verified! Please set your new password.', 'success')
        return redirect(url_for('auth.reset_password'))

    return render_template('auth/verify_code.html', form=form, email=email, dev_code=dev_code)


@auth_bp.route('/resend-code', methods=['POST'])
@limiter.limit("4 per minute", methods=["POST"])
def resend_code():
    email = session.get('reset_email')
    if not email:
        flash('Session expired. Please enter your email again.', 'error')
        return redirect(url_for('auth.forgot_password'))

    user = User.query.filter_by(email=email).first()
    if not user:
        flash('User account not found.', 'error')
        return redirect(url_for('auth.forgot_password'))

    code = f"{secrets.randbelow(900000) + 100000}"
    session['reset_code'] = code
    session['reset_code_expires'] = (datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp()

    email_sent = send_password_reset_code(user.email, code)
    if not email_sent:
        session['dev_code'] = code
        flash('New verification code generated! (SMTP not configured, see notice)', 'info')
    else:
        session.pop('dev_code', None)
        flash('A new verification code has been sent to your email.', 'success')

    return redirect(url_for('auth.verify_code'))


@auth_bp.route('/reset-password', methods=['GET', 'POST'])
@limiter.limit("10 per minute", methods=["POST"])
def reset_password():
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))

    email = session.get('reset_email')
    verified = session.get('reset_verified', False)

    if not email or not verified:
        flash('Please verify your email address first.', 'error')
        return redirect(url_for('auth.forgot_password'))

    user = User.query.filter_by(email=email).first()
    if not user:
        flash('Account not found. Please try again.', 'error')
        return redirect(url_for('auth.forgot_password'))

    form = ResetPasswordForm()
    if form.validate_on_submit():
        user.set_password(form.password.data)
        db.session.commit()

        # Clear reset session state
        session.pop('reset_email', None)
        session.pop('reset_verified', None)
        session.pop('reset_code_expires', None)

        flash('Your password has been changed successfully! You can now log in.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('auth/reset_password.html', form=form, email=email)


