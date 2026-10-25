import asyncio
import importlib
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import jwt
import pytest

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


def test_public_demo_teacher_list_returns_only_names_and_usernames():
    demo_teachers = [
        {"name": "Nadeem Sir", "username": "t_nadeem"},
        {"name": "Prinshu Sir", "username": "t_prinshu"},
        {"name": "Abhishek Sir", "username": "t_abhishek"},
    ]
    users = SimpleNamespace(
        find=Mock(
            return_value=SimpleNamespace(to_list=AsyncMock(return_value=demo_teachers))
        )
    )

    with patch.object(server, "db", SimpleNamespace(users=users)):
        response = asyncio.run(server.get_demo_teachers())

    assert [teacher["username"] for teacher in response] == [
        "t_nadeem",
        "t_prinshu",
        "t_abhishek",
    ]
    assert all(set(teacher) == {"name", "username"} for teacher in response)


def test_admin_can_reassign_schedule_to_another_teacher():
    existing = {
        "id": "schedule-1",
        "teacher_id": "teacher-1",
        "teacher_name": "Teacher One",
        "day": "Monday",
        "period": 1,
        "subject": "Math",
        "class_name": "Grade 9A",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    teacher = {
        "id": "teacher-2",
        "username": "teacher2",
        "name": "Teacher Two",
        "role": "teacher",
    }
    updated = {**existing, "teacher_id": "teacher-2", "teacher_name": "Teacher Two"}
    updated["updated_at"] = "2026-01-02T00:00:00+00:00"
    schedules = SimpleNamespace(
        find_one=AsyncMock(side_effect=[existing, updated]),
        update_one=AsyncMock(),
    )
    users = SimpleNamespace(find_one=AsyncMock(return_value=teacher))
    changelogs = SimpleNamespace(insert_one=AsyncMock())
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    with patch.object(
        server,
        "db",
        SimpleNamespace(schedules=schedules, users=users, changelogs=changelogs),
    ):
        response = asyncio.run(
            server.update_schedule(
                "schedule-1",
                server.ScheduleUpdate(teacher_id="teacher-2"),
                admin,
            )
        )

    assert response.teacher_id == "teacher-2"
    assert response.teacher_name == "Teacher Two"
    schedules.update_one.assert_awaited_once()
    changelogs.insert_one.assert_awaited_once()


def test_schedule_values_are_saved_as_subject_and_grade_options():
    subjects = SimpleNamespace(update_one=AsyncMock())
    grades = SimpleNamespace(update_one=AsyncMock())

    with patch.object(
        server,
        "db",
        SimpleNamespace(catalog_subjects=subjects, catalog_grades=grades),
    ):
        asyncio.run(server._save_schedule_catalog_values("Biology", "XI-A"))

    subjects.update_one.assert_awaited_once_with(
        {"id": "biology"},
        {"$set": {"id": "biology", "name": "Biology"}},
        upsert=True,
    )
    grades.update_one.assert_awaited_once_with(
        {"id": "xi--a"},
        {
            "$set": {
                "id": "xi--a",
                "standard": "XI",
                "section": "A",
                "name": "XI-A",
            }
        },
        upsert=True,
    )


def test_catalog_migration_seeds_defaults_and_runs_once():
    subjects = SimpleNamespace(update_one=AsyncMock())
    grades = SimpleNamespace(update_one=AsyncMock())
    metadata = SimpleNamespace(
        find_one=AsyncMock(side_effect=[None, {"id": "schedule_catalog_v1"}]),
        insert_one=AsyncMock(),
    )
    schedules = SimpleNamespace(
        find=Mock(
            return_value=SimpleNamespace(
                to_list=AsyncMock(
                    return_value=[
                        {"subject": "Biology", "class_name": "Grade 9C"},
                    ]
                )
            )
        )
    )

    with patch.object(
        server,
        "db",
        SimpleNamespace(
            catalog_subjects=subjects,
            catalog_grades=grades,
            catalog_metadata=metadata,
            schedules=schedules,
        ),
    ):
        asyncio.run(server._initialize_schedule_catalog())
        asyncio.run(server._initialize_schedule_catalog())

    assert subjects.update_one.await_count == len(server.DEFAULT_SUBJECT_OPTIONS) + 1
    assert grades.update_one.await_count == len(server.DEFAULT_GRADE_OPTIONS) + 1
    metadata.insert_one.assert_awaited_once_with({"id": "schedule_catalog_v1"})


def test_teacher_cannot_manage_schedule_catalog():
    teacher = server.User(
        id="teacher-1",
        username="teacher",
        name="Teacher",
        role="teacher",
    )

    with pytest.raises(server.HTTPException) as error:
        asyncio.run(
            server.create_grade_option(
                server.GradeOptionCreate(standard="XI", section="A"),
                teacher,
            )
        )

    assert error.value.status_code == 403
