import app.core.cache as cachemod
from app.core.cache import _BoundedTTLCache


def test_bounded_cache_evicts_lru():
    c = _BoundedTTLCache(3)
    for i in range(5):
        c.set(f"k{i}", "v", 100)
    assert len(c) == 3
    assert c.get("k0") is None and c.get("k1") is None  # oldest evicted
    assert c.get("k4") == "v"


def test_bounded_cache_ttl_expiry(monkeypatch):
    c = _BoundedTTLCache(10)
    now = [1000.0]
    monkeypatch.setattr(cachemod.time, "monotonic", lambda: now[0])
    c.set("k", "v", 5)
    assert c.get("k") == "v"
    now[0] = 1006.0  # past TTL
    assert c.get("k") is None


def test_bounded_cache_delete_prefix():
    c = _BoundedTTLCache(10)
    c.set("ds:1:a", "v", 100)
    c.set("ds:1:b", "v", 100)
    c.set("ds:2:c", "v", 100)
    c.delete_prefix("ds:1:")
    assert c.get("ds:1:a") is None and c.get("ds:1:b") is None
    assert c.get("ds:2:c") == "v"


def test_lru_touch_on_get():
    c = _BoundedTTLCache(2)
    c.set("a", "1", 100)
    c.set("b", "1", 100)
    assert c.get("a") == "1"  # touch a -> b is now LRU
    c.set("c", "1", 100)      # evicts b
    assert c.get("b") is None and c.get("a") == "1" and c.get("c") == "1"
