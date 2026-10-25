import asyncio
import importlib
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import jwt

os.environ["MONGO_URL"] = "mongodb://localhost:27017"
os.environ["DB_NAME"] = "test_db"
os.environ["JWT_SECRET_KEY"] = "test-secret-for-auth-tests-with-32-bytes"

server = importlib.import_module("server")


def test_password_hash_verifies_only_matching_password():
    hashed = server.hash_password("test-password")

    assert hashed.startswith("$2b$")
    assert server.verify_password("test-password", hashed)
    assert not server.verify_password("wrong-password", hashed)


def test_token_contains_user_claims_and_expiration():
    token = server.create_token("user-123", "teacher", "teacher")
    payload = jwt.decode(
        token,
        server.SECRET_KEY,
        algorithms=[server.ALGORITHM],
    )

    assert payload["sub"] == "user-123"
    assert payload["username"] == "teacher"
    assert payload["role"] == "teacher"
    assert "exp" in payload


def test_login_accepts_seeded_admin_credentials():
    admin = server.User(
        id="admin-test-id",
        username="admin123",
        name="Administrator",
        role="admin",
    ).model_dump()
    admin["password_hash"] = server.hash_password("password123")

    users = SimpleNamespace(find_one=AsyncMock(return_value=admin))
    with patch.object(server, "db", SimpleNamespace(users=users)):
        response = asyncio.run(
            server.login(server.UserLogin(username="admin123", password="password123"))
        )

    assert response.user.username == "admin123"
    assert response.user.role == "admin"
