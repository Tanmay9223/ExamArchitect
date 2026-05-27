"""
Rate Limiter for ExamArchitect API
====================================
In-memory sliding window rate limiter. No external dependencies required
(Redis-compatible upgrade path is documented at the bottom).

All limits are configurable via environment variables.
"""
import os
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Optional

# pyrefly: ignore [missing-import]
from fastapi import Request, HTTPException, status


# ---------------------------------------------------------------------------
# Configuration – all values are read from env variables with sane defaults
# ---------------------------------------------------------------------------

# Auth endpoints (per IP)
AUTH_RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_AUTH_REQUESTS", "5"))
AUTH_RATE_LIMIT_WINDOW   = int(os.getenv("RATE_LIMIT_AUTH_WINDOW_SECONDS", "60"))  # 1 minute

# Exam / study-plan generation endpoints
EXAM_RATE_LIMIT_GUEST_REQUESTS  = int(os.getenv("RATE_LIMIT_EXAM_GUEST_REQUESTS", "10"))
EXAM_RATE_LIMIT_GUEST_WINDOW    = int(os.getenv("RATE_LIMIT_EXAM_GUEST_WINDOW_SECONDS", "3600"))  # 1 hour
EXAM_RATE_LIMIT_USER_REQUESTS   = int(os.getenv("RATE_LIMIT_EXAM_USER_REQUESTS", "50"))
EXAM_RATE_LIMIT_USER_WINDOW     = int(os.getenv("RATE_LIMIT_EXAM_USER_WINDOW_SECONDS", "3600"))  # 1 hour

# Admin endpoint protection (per IP – guards unauthorized repeated attempts)
ADMIN_RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_ADMIN_REQUESTS", "30"))
ADMIN_RATE_LIMIT_WINDOW   = int(os.getenv("RATE_LIMIT_ADMIN_WINDOW_SECONDS", "60"))


# ---------------------------------------------------------------------------
# Sliding Window Store
# ---------------------------------------------------------------------------

class SlidingWindowStore:
    """
    Thread-safe in-memory sliding window counter.
    Each key holds a deque of timestamps of requests within the window.
    """
    def __init__(self):
        self._store: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """
        Returns (allowed: bool, retry_after_seconds: int).
        Prunes expired timestamps and checks current count.
        """
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            bucket = self._store[key]

            # Remove timestamps older than the window
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= max_requests:
                # Earliest timestamp in window tells us when the window resets
                retry_after = int(bucket[0] - cutoff) + 1
                return False, retry_after

            bucket.append(now)
            return True, 0


# Singleton store shared across all requests
_store = SlidingWindowStore()


# ---------------------------------------------------------------------------
# Helper – extract the real client IP (handles proxies / X-Forwarded-For)
# ---------------------------------------------------------------------------

def _get_client_ip(request: Request) -> str:
    # Respect reverse-proxy headers if present
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first (client) IP in the chain
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# ---------------------------------------------------------------------------
# Dependency factories – use these in route definitions
# ---------------------------------------------------------------------------

def auth_rate_limit(request: Request) -> None:
    """
    5 requests per minute per IP for /login and /register.
    """
    ip = _get_client_ip(request)
    key = f"auth:{ip}"
    allowed, retry_after = _store.is_allowed(key, AUTH_RATE_LIMIT_REQUESTS, AUTH_RATE_LIMIT_WINDOW)

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many authentication attempts. "
                f"Please wait {retry_after} second(s) before trying again."
            ),
            headers={"Retry-After": str(retry_after)},
        )


def exam_rate_limit(request: Request) -> None:
    """
    Guest  → 10 requests / hour (keyed by IP)
    Logged-in → 50 requests / hour (keyed by JWT user email extracted from header)
    """
    from jose import jwt as jose_jwt, JWTError
    from .auth import SECRET_KEY, ALGORITHM

    user_email: Optional[str] = None

    # Attempt to extract user identity from the Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_email = payload.get("sub")
        except JWTError:
            pass  # Fall through to guest limits

    if user_email:
        key = f"exam:user:{user_email}"
        max_req = EXAM_RATE_LIMIT_USER_REQUESTS
        window  = EXAM_RATE_LIMIT_USER_WINDOW
    else:
        ip = _get_client_ip(request)
        key = f"exam:guest:{ip}"
        max_req = EXAM_RATE_LIMIT_GUEST_REQUESTS
        window  = EXAM_RATE_LIMIT_GUEST_WINDOW

    allowed, retry_after = _store.is_allowed(key, max_req, window)

    if not allowed:
        scope = "authenticated users" if user_email else "guest users"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Hourly exam generation limit reached for {scope}. "
                f"Please wait {retry_after} second(s) or log in for a higher quota."
            ),
            headers={"Retry-After": str(retry_after)},
        )


def admin_rate_limit(request: Request) -> None:
    """
    30 requests per minute per IP for /api/admin/* endpoints.
    Guards against repeated unauthorized access attempts.
    """
    ip = _get_client_ip(request)
    key = f"admin:{ip}"
    allowed, retry_after = _store.is_allowed(key, ADMIN_RATE_LIMIT_REQUESTS, ADMIN_RATE_LIMIT_WINDOW)

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many requests to admin endpoints. "
                f"Please wait {retry_after} second(s)."
            ),
            headers={"Retry-After": str(retry_after)},
        )


# ---------------------------------------------------------------------------
# Notes for upgrading to Redis (production at scale)
# ---------------------------------------------------------------------------
#
# Replace SlidingWindowStore.is_allowed() with a Lua script against Redis:
#
#   EVAL """
#     local key = KEYS[1]
#     local now = tonumber(ARGV[1])
#     local window = tonumber(ARGV[2])
#     local limit = tonumber(ARGV[3])
#     redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
#     local count = redis.call('ZCARD', key)
#     if count < limit then
#       redis.call('ZADD', key, now, now)
#       redis.call('EXPIRE', key, window)
#       return 1
#     end
#     return 0
#   """ 1 <key> <now_ms> <window_ms> <limit>
#
# This gives you distributed, horizontally-scalable rate limiting with zero
# code changes to the route layer.
