from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit_logs,
    auth,
    chats,
    datasets,
    forecasts,
    reports,
    settings,
    users,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(settings.router)
api_router.include_router(audit_logs.router)
api_router.include_router(datasets.router)
api_router.include_router(reports.router)
api_router.include_router(forecasts.router)
api_router.include_router(chats.router)
