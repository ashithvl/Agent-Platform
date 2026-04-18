"""Canonical demo users. Mirrors apps/web/src/auth/localUsers.ts `SEED`."""
from __future__ import annotations

# Plain passwords only because this is dev-seed data. Real deployments wipe
# the row on first login and require users to reset.
SEED_USERS: list[dict] = [
    {
        "username": "admin",
        "password": "admin",
        "roles": ["platform-admin", "admin", "consumer", "builder"],
    },
    {
        "username": "developer",
        "password": "developer",
        "roles": ["consumer", "builder"],
    },
    {
        "username": "user",
        "password": "user",
        "roles": ["consumer", "builder"],
    },
]
