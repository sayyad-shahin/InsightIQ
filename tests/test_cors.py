"""
CORS preflight tests. Verifies CORSMiddleware returns Access-Control-Allow-Origin
for allowed origins (explicit list AND the onrender regex) and withholds it for
unknown origins. Runs through the full middleware stack via TestClient.
"""


def _preflight(client, path, origin, method="POST"):
    return client.options(
        path,
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )


def test_preflight_allows_onrender_frontend_via_regex(client):
    """The deployed frontend origin is allowed by CORS_ORIGIN_REGEX."""
    origin = "https://insightiq-frontend-i4vy.onrender.com"
    for path in ("/api/v1/auth/signup", "/api/v1/datasets/upload"):
        r = _preflight(client, path, origin)
        assert r.status_code == 200, path
        assert r.headers.get("access-control-allow-origin") == origin, path
        assert r.headers.get("access-control-allow-credentials") == "true", path


def test_preflight_allows_localhost_from_cors_origins(client):
    """The explicit CORS_ORIGINS list (localhost dev) is allowed."""
    origin = "http://localhost:5173"
    r = _preflight(client, "/api/v1/auth/login", origin)
    assert r.headers.get("access-control-allow-origin") == origin


def test_preflight_blocks_unknown_origin(client):
    """An origin that is neither in the list nor matches the regex gets no header."""
    r = _preflight(client, "/api/v1/auth/signup", "https://evil.example.com")
    assert r.headers.get("access-control-allow-origin") is None


def test_error_response_still_carries_cors_header(client):
    """Regression: CORS must be the OUTERMOST middleware so a request short-circuited
    by the CSRF/auth middleware (a 403) still gets Access-Control-Allow-Origin. If CORS
    sat inside the CSRF middleware, that 403 would reach the browser without CORS
    headers and surface as a misleading 'CORS blocked' error."""
    origin = "https://insightiq-frontend-i4vy.onrender.com"
    # A stale auth cookie with no CSRF header triggers the CSRF middleware's 403.
    r = client.post(
        "/api/v1/datasets/upload",
        headers={"Origin": origin, "Cookie": "iq_access=stale"},
    )
    assert r.status_code in (401, 403)
    assert r.headers.get("access-control-allow-origin") == origin
