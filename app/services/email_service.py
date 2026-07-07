import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.core.logging import logger


def _send(to_email: str, subject: str, html_body: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        # Development fallback: log the email instead of sending it so local
        # setups without SMTP credentials still work end to end.
        logger.info(f"[email:dev-mode] To={to_email} Subject={subject}\n{html_body}")
        return

    message = EmailMessage()
    message["From"] = settings.EMAIL_FROM
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content("Please view this email in an HTML-capable client.")
    message.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)


def send_verification_email(to_email: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    _send(
        to_email,
        "Verify your InsightIQ account",
        f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
          <h2>Welcome to InsightIQ</h2>
          <p>Please confirm your email address to activate your account.</p>
          <p><a href="{link}" style="background:#0C447C;color:#fff;padding:10px 18px;
             border-radius:8px;text-decoration:none;">Verify email</a></p>
          <p>Or copy this link: {link}</p>
        </div>
        """,
    )


def send_password_reset_email(to_email: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    _send(
        to_email,
        "Reset your InsightIQ password",
        f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
          <h2>Reset your password</h2>
          <p>We received a request to reset your InsightIQ password. This link expires in 1 hour.</p>
          <p><a href="{link}" style="background:#0C447C;color:#fff;padding:10px 18px;
             border-radius:8px;text-decoration:none;">Reset password</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </div>
        """,
    )
