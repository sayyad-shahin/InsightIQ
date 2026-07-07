from fastapi import APIRouter

from app.api.v1.endpoints import audit_logs, auth, datasets, users

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(audit_logs.router)
api_router.include_router(datasets.router)

# Additional routers (analytics, forecast, chat, reports) are added in
# subsequent build steps as those services are implemented.
