import smtplib
from email.message import EmailMessage
from flask import current_app


def send_password_reset_code(to_email: str, code: str) -> bool:
    """Send a 6-digit verification code email styled identically to standard account verification emails.
    
    If SMTP server is configured, sends via SMTP.
    If not configured, logs the code to current_app.logger and returns False.
    """
    mail_server = current_app.config.get('MAIL_SERVER')
    mail_username = current_app.config.get('MAIL_USERNAME')
    mail_password = current_app.config.get('MAIL_PASSWORD')
    mail_port = current_app.config.get('MAIL_PORT', 587)
    use_tls = current_app.config.get('MAIL_USE_TLS', True)
    use_ssl = current_app.config.get('MAIL_USE_SSL', False)
    default_sender = current_app.config.get('MAIL_DEFAULT_SENDER', 'Mayūra. Account <no-reply@sakmusic.local>')

    # Formatted exactly to trigger Gmail's native "Code Requested" copy-code card and match the screenshot
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mayūra. Account - Verification Code</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      padding: 24px 16px;
      margin: 0;
      line-height: 1.5;
    }}
    .email-wrapper {{
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 32px 28px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }}
    .brand-header {{
      display: flex;
      align-items: center;
      margin-bottom: 24px;
    }}
    .brand-icon {{
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981, #059669);
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
      margin-right: 10px;
      text-align: center;
      line-height: 32px;
    }}
    .brand-title {{
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      vertical-align: middle;
    }}
    .verified-badge {{
      display: inline-block;
      width: 16px;
      height: 16px;
      background: #10b981;
      color: #ffffff;
      border-radius: 50%;
      font-size: 11px;
      line-height: 16px;
      text-align: center;
      margin-left: 5px;
      vertical-align: middle;
    }}
    .greeting {{
      font-size: 15px;
      color: #1e293b;
      margin: 0 0 16px 0;
    }}
    .greeting a {{
      color: #0284c7;
      text-decoration: underline;
    }}
    .label {{
      font-size: 15px;
      color: #1e293b;
      margin: 0 0 8px 0;
    }}
    .code-display {{
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #0f172a;
      margin: 8px 0 24px 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }}
    .message {{
      font-size: 14px;
      color: #334155;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }}
    .footer {{
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
      margin-top: 16px;
    }}
  </style>
</head>
<body>
  <div class="email-wrapper">
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
      <tr>
        <td style="vertical-align: middle; padding-right: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: #10b981; text-align: center; line-height: 32px; color: #ffffff; font-size: 16px; font-weight: bold;">
            &#9835;
          </div>
        </td>
        <td style="vertical-align: middle;">
          <span style="font-size: 16px; font-weight: 700; color: #0f172a;">Mayūra. Account</span>
          <span style="display: inline-block; width: 16px; height: 16px; background: #0284c7; color: #ffffff; border-radius: 50%; font-size: 10px; line-height: 16px; text-align: center; margin-left: 4px; vertical-align: middle;">&#10003;</span>
        </td>
      </tr>
    </table>

    <p class="greeting">
      Dear <a href="mailto:{to_email}">{to_email}</a>,
    </p>

    <p class="label">
      Verification code:
    </p>

    <div class="code-display">
      {code}
    </div>

    <p class="message">
      Someone tried to use Mayūra. Account Center to modify your account settings. If this was you, please use the code above to confirm your identity. The verification code is valid for 10 minutes.
    </p>

    <div class="footer">
      This is an automated message from Mayūra. Please do not reply to this email.
    </div>
  </div>
</body>
</html>"""

    plain_content = f"""Dear {to_email},

Verification code:

{code}

Someone tried to use Mayūra. Account Center to modify your account settings. If this was you, please use the code above to confirm your identity. The verification code is valid for 10 minutes.
"""

    if not mail_server or not mail_username:
        current_app.logger.info(f"[Password Reset] SMTP not configured. Verification code for {to_email}: {code}")
        return False

    try:
        msg = EmailMessage()
        msg['Subject'] = 'Mayūra. Account - Verification Code'
        msg['From'] = default_sender
        msg['To'] = to_email
        msg.set_content(plain_content)
        msg.add_alternative(html_content, subtype='html')

        if use_ssl:
            with smtplib.SMTP_SSL(mail_server, mail_port, timeout=10) as server:
                if mail_password:
                    server.login(mail_username, mail_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(mail_server, mail_port, timeout=10) as server:
                if use_tls:
                    server.starttls()
                if mail_password:
                    server.login(mail_username, mail_password)
                server.send_message(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"[Password Reset] Failed to send email to {to_email}: {e}")
        return False
