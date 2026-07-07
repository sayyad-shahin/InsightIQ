from app.core.config import settings
from app.core.logging import logger

_FALLBACK_NOTICE = (
    "The AI assistant is not configured on this server (missing GOOGLE_API_KEY). "
    "Your message was saved, but no AI response could be generated."
)


def is_ai_configured() -> bool:
    return bool(settings.GOOGLE_API_KEY)


def generate_chat_reply(user_message: str, dataset_context: str | None = None) -> str:
    """
    Generate an assistant reply via Google Gemini. Degrades gracefully: if the
    API key or the SDK is unavailable, or the call fails, a clear, non-fatal
    message is returned so the chat flow never 500s.
    """
    if not is_ai_configured():
        return _FALLBACK_NOTICE

    try:
        import google.generativeai as genai  # lazy: optional heavy dependency
    except ImportError:
        logger.warning("google-generativeai is not installed; returning fallback chat reply")
        return _FALLBACK_NOTICE

    try:
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        prompt = user_message
        if dataset_context:
            prompt = f"Dataset context:\n{dataset_context}\n\nUser question: {user_message}"
        response = model.generate_content(prompt)
        text = (getattr(response, "text", None) or "").strip()
        return text or "The model returned an empty response."
    except Exception as exc:  # noqa: BLE001 - never let a provider error break the endpoint
        logger.error(f"Gemini chat generation failed: {exc}")
        return "The AI assistant is temporarily unavailable. Please try again shortly."
