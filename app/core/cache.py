"""
Small caching helper backed by Redis with a graceful in-process fallback.

If Redis is unavailable (dev/test, or a transient outage) the cache degrades to a
per-process dict so callers never fail — they just lose cross-worker sharing.
Values are JSON-serialized. Keys embed the dataset's ``updated_at`` so any write
that bumps the timestamp (cleaning, re-profiling) naturally invalidates old
entries; ``invalidate_dataset`` additionally purges stale keys eagerly.
"""

from __future__ import annotations

import json
from typing import Any

from app.core.config import settings
from app.core.logging import logger

_client: Any = None
_unavailable = False
_memory: dict[str, str] = {}


def _redis():
    global _client, _unavailable
    if _unavailable:
        return None
    if _client is None:
        try:
            import redis  # lazy import; optional at runtime

            _client = redis.Redis.from_url(
                settings.REDIS_URL, socket_connect_timeout=0.5, socket_timeout=0.5
            )
            _client.ping()
        except Exception as exc:  # noqa: BLE001 - fall back to in-process cache
            logger.warning(f"Redis cache unavailable; using in-process fallback ({exc})")
            _unavailable = True
            _client = None
    return _client


def cache_get(key: str) -> Any | None:
    client = _redis()
    try:
        raw = client.get(key) if client else _memory.get(key)
    except Exception:  # noqa: BLE001
        raw = _memory.get(key)
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return None


def cache_set(key: str, value: Any, ttl: int = 900) -> None:
    data = json.dumps(value, default=str)
    client = _redis()
    try:
        if client:
            client.setex(key, ttl, data)
        else:
            _memory[key] = data
    except Exception:  # noqa: BLE001
        _memory[key] = data


def invalidate_dataset(dataset_id: str) -> None:
    """Purge every cached artifact for a dataset (called on clean/delete)."""
    prefix = f"ds:{dataset_id}:"
    client = _redis()
    try:
        if client:
            for k in client.scan_iter(match=f"{prefix}*"):
                client.delete(k)
    except Exception:  # noqa: BLE001
        pass
    for k in [k for k in _memory if k.startswith(prefix)]:
        _memory.pop(k, None)


def dataset_key(kind: str, dataset_id: str, updated_at: Any, *parts: str) -> str:
    suffix = ":".join(str(p) for p in parts if p)
    return f"ds:{dataset_id}:{kind}:{updated_at}" + (f":{suffix}" if suffix else "")
