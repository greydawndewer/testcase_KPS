import asyncio
import importlib
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import jwt
import pytest
from bson import ObjectId
from fastapi.encoders import jsonable_encoder

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
    assert changelogs.insert_one.await_count == 2
    change_targets = [
        call.args[0]["teacher_id"] for call in changelogs.insert_one.await_args_list
    ]
    assert change_targets == ["teacher-1", "teacher-2"]


def test_teacher_changelogs_are_scoped_to_the_authenticated_teacher():
    cursor = SimpleNamespace(
        sort=Mock(return_value=None),
        to_list=AsyncMock(return_value=[]),
    )
    cursor.sort.return_value = cursor
    changelogs = SimpleNamespace(find=Mock(return_value=cursor))
    teacher = server.User(
        id="teacher-1",
        username="teacher",
        name="Teacher",
        role="teacher",
    )

    with patch.object(server, "db", SimpleNamespace(changelogs=changelogs)):
        response = asyncio.run(server.get_changelogs(current_user=teacher))

    assert response == []
    changelogs.find.assert_called_once_with({"teacher_id": "teacher-1"}, {"_id": 0})


def test_admin_schedule_creation_writes_a_teacher_specific_update():
    schedules = SimpleNamespace(
        find_one=AsyncMock(return_value=None),
        insert_one=AsyncMock(),
    )
    changelogs = SimpleNamespace(insert_one=AsyncMock())
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )
    schedule_data = server.ScheduleCreate(
        teacher_id="teacher-1",
        teacher_name="Teacher One",
        day="Monday",
        period=2,
        subject="Physics",
        class_name="XI-A",
    )

    with (
        patch.object(
            server,
            "db",
            SimpleNamespace(schedules=schedules, changelogs=changelogs),
        ),
        patch.object(server, "_save_schedule_catalog_values", new=AsyncMock()),
    ):
        schedule = asyncio.run(server.create_schedule(schedule_data, admin))

    changelog = changelogs.insert_one.await_args.args[0]
    assert changelog["teacher_id"] == "teacher-1"
    assert changelog["action"] == "added"
    assert changelog["old_value"] == "No lesson"
    assert (
        changelog["new_value"]
        == "Subject: Physics · Class: XI-A · Teacher: Teacher One"
    )
    assert changelog["schedule_id"] == schedule.id


def test_admin_schedule_deletion_writes_a_teacher_specific_update():
    existing = {
        "id": "schedule-1",
        "teacher_id": "teacher-1",
        "teacher_name": "Teacher One",
        "day": "Monday",
        "period": 2,
        "subject": "Physics",
        "class_name": "XI-A",
    }
    schedules = SimpleNamespace(
        find_one=AsyncMock(return_value=existing),
        delete_one=AsyncMock(return_value=SimpleNamespace(deleted_count=1)),
    )
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
        SimpleNamespace(schedules=schedules, changelogs=changelogs),
    ):
        asyncio.run(server.delete_schedule("schedule-1", admin))

    changelog = changelogs.insert_one.await_args.args[0]
    assert changelog["teacher_id"] == "teacher-1"
    assert changelog["action"] == "removed"
    assert (
        changelog["old_value"]
        == "Subject: Physics · Class: XI-A · Teacher: Teacher One"
    )
    assert changelog["new_value"] == "No lesson"


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


def test_catalog_migration_removes_legacy_fixtures_once():
    subjects = SimpleNamespace(delete_many=AsyncMock(), update_one=AsyncMock())
    grades = SimpleNamespace(delete_many=AsyncMock())
    metadata = SimpleNamespace(
        find_one=AsyncMock(side_effect=[None, {"id": "schedule_catalog_v2"}]),
        insert_one=AsyncMock(),
    )

    with patch.object(
        server,
        "db",
        SimpleNamespace(
            catalog_subjects=subjects,
            catalog_grades=grades,
            catalog_metadata=metadata,
        ),
    ):
        asyncio.run(server._initialize_schedule_catalog())
        asyncio.run(server._initialize_schedule_catalog())

    subjects.delete_many.assert_awaited_once_with(
        {"id": {"$in": server.LEGACY_SEEDED_SUBJECT_IDS}}
    )
    grades.delete_many.assert_awaited_once_with(
        {"id": {"$in": server.LEGACY_SEEDED_GRADE_IDS}}
    )
    metadata.insert_one.assert_awaited_once_with({"id": "schedule_catalog_v2"})
    assert subjects.update_one.await_count == 2
    subjects.update_one.assert_awaited_with(
        {"id": "substitution"},
        {"$set": {"id": "substitution", "name": "SUBSTITUTION"}},
        upsert=True,
    )


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


def test_substitution_subject_cannot_be_removed():
    subjects = SimpleNamespace(delete_one=AsyncMock())
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    with patch.object(server, "db", SimpleNamespace(catalog_subjects=subjects)):
        with pytest.raises(server.HTTPException) as error:
            asyncio.run(server.delete_subject_option("substitution", admin))

    assert error.value.status_code == 400
    subjects.delete_one.assert_not_awaited()


def test_admin_can_create_markdown_announcement():
    announcements = SimpleNamespace(insert_one=AsyncMock())
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    with patch.object(server, "db", SimpleNamespace(announcements=announcements)):
        announcement = asyncio.run(
            server.create_announcement(
                server.AnnouncementCreate(
                    title="  Exam update  ",
                    body="  Formula: $E = mc^2$  ",
                ),
                admin,
            )
        )

    assert announcement["title"] == "Exam update"
    assert announcement["body"] == "Formula: $E = mc^2$"
    assert announcement["created_by"] == "Administrator"
    stored_announcement = announcements.insert_one.await_args.args[0]
    assert stored_announcement["id"] == announcement["id"]
    assert stored_announcement["expires_at"].isoformat() == announcement["expires_at"]
    created_at = server.datetime.fromisoformat(stored_announcement["created_at"])
    expiry_duration = stored_announcement["expires_at"] - created_at
    assert expiry_duration == server.timedelta(days=7)


def test_announcement_database_failure_returns_service_unavailable():
    announcements = SimpleNamespace(
        insert_one=AsyncMock(side_effect=server.PyMongoError("database unavailable"))
    )
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    database = SimpleNamespace(announcements=announcements)
    with patch.object(server, "db", database):
        with pytest.raises(server.HTTPException) as error:
            asyncio.run(
                server.create_announcement(
                    server.AnnouncementCreate(title="Hello", body="A message"),
                    admin,
                )
            )

    assert error.value.status_code == 503


def test_announcement_response_excludes_mongo_object_id():
    async def insert_with_object_id(document):
        document["_id"] = ObjectId()

    announcements = SimpleNamespace(
        insert_one=AsyncMock(side_effect=insert_with_object_id)
    )
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    with patch.object(server, "db", SimpleNamespace(announcements=announcements)):
        response = asyncio.run(
            server.create_announcement(
                server.AnnouncementCreate(title="Hello", body="A message"),
                admin,
            )
        )

    assert "_id" not in response
    assert response["title"] == "Hello"
    encoded_response = jsonable_encoder(response)
    assert "_id" not in encoded_response


def test_expired_announcements_are_cleaned_up_including_legacy_records():
    announcements = SimpleNamespace(delete_many=AsyncMock())

    database = SimpleNamespace(announcements=announcements)
    with patch.object(server, "db", database):
        asyncio.run(server._delete_expired_announcements())

    query = announcements.delete_many.await_args.args[0]
    expiry_cutoff = query["$or"][0]["expires_at"]["$lte"]
    assert isinstance(expiry_cutoff, server.datetime)
    assert expiry_cutoff.tzinfo == server.timezone.utc
    assert query["$or"][1]["expires_at"].get("$exists") is False
    assert "created_at" in query["$or"][1]


def test_admin_can_delete_latest_announcements():
    cursor = SimpleNamespace(
        sort=Mock(),
        limit=Mock(),
        to_list=AsyncMock(return_value=[{"id": "new-1"}, {"id": "new-2"}]),
    )
    cursor.sort.return_value = cursor
    cursor.limit.return_value = cursor
    announcements = SimpleNamespace(
        find=Mock(return_value=cursor),
        delete_many=AsyncMock(return_value=SimpleNamespace(deleted_count=2)),
    )
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    with patch.object(server, "db", SimpleNamespace(announcements=announcements)):
        result = asyncio.run(server.delete_latest_announcements(2, admin))

    assert result == {"deleted_count": 2}
    deleted_filter = {"id": {"$in": ["new-1", "new-2"]}}
    announcements.delete_many.assert_awaited_with(deleted_filter)


def test_holiday_response_excludes_mongo_object_id():
    async def insert_with_object_id(document):
        document["_id"] = ObjectId()

    holidays = SimpleNamespace(
        find_one=AsyncMock(return_value=None),
        insert_one=AsyncMock(side_effect=insert_with_object_id),
    )
    settings = SimpleNamespace(find_one=AsyncMock(return_value=None))
    teacher_cursor = SimpleNamespace(to_list=AsyncMock(return_value=[]))
    users = SimpleNamespace(find=Mock(return_value=teacher_cursor))
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    database = SimpleNamespace(
        holidays=holidays,
        settings=settings,
        users=users,
    )
    with (
        patch.object(server, "db", database),
        patch.object(server, "_validate_holiday_date"),
    ):
        response = asyncio.run(
            server.create_holiday(
                server.HolidayCreate(
                    day=server.date(2026, 11, 3),
                    name="School event",
                ),
                admin,
            )
        )

    assert "_id" not in response
    assert response["name"] == "School event"
    encoded_response = jsonable_encoder(response)
    assert "_id" not in encoded_response


def test_teacher_cannot_publish_announcement():
    teacher = server.User(
        id="teacher-1",
        username="teacher",
        name="Teacher",
        role="teacher",
    )

    with pytest.raises(server.HTTPException) as error:
        asyncio.run(
            server.create_announcement(
                server.AnnouncementCreate(title="Hello", body="A message"),
                teacher,
            )
        )

    assert error.value.status_code == 403


def test_period_time_validation_accepts_continuous_periods_and_configured_break():
    period_times = [
        server.PeriodTime(start="08:00", end="08:45"),
        server.PeriodTime(start="08:45", end="09:30"),
        server.PeriodTime(start="09:30", end="10:15"),
        server.PeriodTime(start="10:30", end="11:15"),
        server.PeriodTime(start="11:15", end="12:00"),
        server.PeriodTime(start="12:00", end="12:45"),
        server.PeriodTime(start="12:45", end="13:30"),
        server.PeriodTime(start="13:30", end="14:15"),
    ]

    server.validate_period_times(period_times, 3, 15)


def test_period_time_validation_rejects_gaps_outside_break():
    period_times = [
        server.PeriodTime(start="08:00", end="08:45"),
        server.PeriodTime(start="08:50", end="09:30"),
        server.PeriodTime(start="09:30", end="10:15"),
        server.PeriodTime(start="10:30", end="11:15"),
        server.PeriodTime(start="11:15", end="12:00"),
        server.PeriodTime(start="12:00", end="12:45"),
        server.PeriodTime(start="12:45", end="13:30"),
        server.PeriodTime(start="13:30", end="14:15"),
    ]

    with pytest.raises(server.HTTPException) as error:
        server.validate_period_times(period_times, 3, 15)
    assert error.value.detail == "Period 2 must start when period 1 ends"


def test_teacher_can_clear_only_their_own_changelog_entry():
    changelogs = SimpleNamespace(
        delete_one=AsyncMock(return_value=SimpleNamespace(deleted_count=1))
    )
    teacher = server.User(
        id="teacher-1",
        username="teacher",
        name="Teacher",
        role="teacher",
    )

    with patch.object(server, "db", SimpleNamespace(changelogs=changelogs)):
        asyncio.run(server.delete_changelog("log-1", teacher))

    changelogs.delete_one.assert_awaited_once_with(
        {"id": "log-1", "teacher_id": "teacher-1"}
    )


def test_legacy_break_update_rejects_inconsistent_configured_period_times():
    settings = SimpleNamespace(
        find_one=AsyncMock(
            return_value={
                "id": "break_settings",
                "break_after_period": 3,
                "break_duration_minutes": 15,
                "period_times": [
                    {"start": "08:00", "end": "08:45"},
                    {"start": "08:45", "end": "09:30"},
                    {"start": "09:30", "end": "10:15"},
                    {"start": "10:30", "end": "11:15"},
                    {"start": "11:15", "end": "12:00"},
                    {"start": "12:00", "end": "12:45"},
                    {"start": "12:45", "end": "13:30"},
                    {"start": "13:30", "end": "14:15"},
                ],
            }
        ),
        update_one=AsyncMock(),
    )
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    with patch.object(server, "db", SimpleNamespace(settings=settings)):
        with pytest.raises(server.HTTPException) as error:
            asyncio.run(server.update_break_settings(4, admin))

    assert error.value.status_code == 400
    settings.update_one.assert_not_awaited()


def test_legacy_break_update_keeps_a_consistent_configured_schedule_valid():
    period_times = [
        {"start": "08:00", "end": "08:45"},
        {"start": "08:45", "end": "09:30"},
        {"start": "09:30", "end": "10:15"},
        {"start": "10:15", "end": "11:00"},
        {"start": "11:15", "end": "12:00"},
        {"start": "12:00", "end": "12:45"},
        {"start": "12:45", "end": "13:30"},
        {"start": "13:30", "end": "14:15"},
    ]
    cursor = SimpleNamespace(to_list=AsyncMock(return_value=[]))
    users = SimpleNamespace(find=Mock(return_value=cursor))
    settings = SimpleNamespace(
        find_one=AsyncMock(
            return_value={
                "id": "break_settings",
                "break_after_period": 3,
                "break_duration_minutes": 15,
                "period_times": period_times,
            }
        ),
        update_one=AsyncMock(),
    )
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    with patch.object(
        server,
        "db",
        SimpleNamespace(settings=settings, users=users),
    ):
        response = asyncio.run(server.update_break_settings(4, admin))

    assert response == {"break_after_period": 4}
    settings.update_one.assert_awaited_once()


def test_legacy_break_update_checks_custom_times_when_defaults_are_unconfigured():
    override = [
        {"start": "08:00", "end": "08:45"},
        {"start": "08:45", "end": "09:30"},
        {"start": "09:30", "end": "10:15"},
        {"start": "10:30", "end": "11:15"},
        {"start": "11:15", "end": "12:00"},
        {"start": "12:00", "end": "12:45"},
        {"start": "12:45", "end": "13:30"},
        {"start": "13:30", "end": "14:15"},
    ]
    cursor = SimpleNamespace(
        to_list=AsyncMock(
            return_value=[
                {"id": "teacher-1", "name": "Teacher", "period_times": override}
            ]
        )
    )
    users = SimpleNamespace(find=Mock(return_value=cursor))
    settings = SimpleNamespace(
        find_one=AsyncMock(
            return_value={
                "id": "break_settings",
                "break_after_period": 3,
                "break_duration_minutes": 15,
            }
        ),
        update_one=AsyncMock(),
    )
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    with patch.object(
        server,
        "db",
        SimpleNamespace(settings=settings, users=users),
    ):
        with pytest.raises(server.HTTPException) as error:
            asyncio.run(server.update_break_settings(4, admin))

    assert error.value.status_code == 400
    settings.update_one.assert_not_awaited()


def test_default_bell_schedule_rejects_timing_that_does_not_fit_eight_periods():
    users = SimpleNamespace(find=Mock())
    settings = SimpleNamespace(update_one=AsyncMock())
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )
    schedule_data = server.BellScheduleUpdate(
        start_time="08:00",
        dismissal_time="13:00",
        break_after_period=3,
        break_duration_minutes=15,
        school_timezone="Asia/Kolkata",
    )

    with patch.object(
        server,
        "db",
        SimpleNamespace(settings=settings, users=users),
    ):
        with pytest.raises(server.HTTPException) as error:
            asyncio.run(server.update_default_bell_schedule(schedule_data, admin))

    assert error.value.status_code == 400
    settings.update_one.assert_not_awaited()


@pytest.mark.parametrize(
    "holiday_date",
    [
        server.date(2026, 11, 3),
        server.date(2026, 11, 7),
        server.date(2026, 11, 9),
    ],
)
def test_holiday_validation_rejects_past_weekend_and_next_week(holiday_date):
    with patch.object(server, "local_today", return_value=server.date(2026, 11, 4)):
        with pytest.raises(server.HTTPException) as error:
            server._validate_holiday_date(holiday_date, "Asia/Kolkata")

    assert error.value.status_code == 400


def test_holiday_validation_accepts_today_and_later_weekday():
    with patch.object(server, "local_today", return_value=server.date(2026, 11, 4)):
        server._validate_holiday_date(server.date(2026, 11, 4), "Asia/Kolkata")
        server._validate_holiday_date(server.date(2026, 11, 6), "Asia/Kolkata")


def test_only_assigned_teacher_can_edit_a_lesson_note():
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )
    note = server.TeacherNoteUpdate(teacher_note="Bring lab materials")

    with pytest.raises(server.HTTPException) as error:
        asyncio.run(server.update_teacher_schedule_note("schedule-1", note, admin))

    assert error.value.status_code == 403


def test_assigned_teacher_can_save_lesson_note():
    schedule = {
        "id": "schedule-1",
        "teacher_id": "teacher-1",
        "teacher_name": "Teacher One",
        "day": "Monday",
        "period": 2,
        "subject": "Science",
        "class_name": "Grade 8A",
        "updated_at": server.datetime.now(server.timezone.utc),
    }
    schedules = SimpleNamespace(
        find_one=AsyncMock(return_value=schedule),
        update_one=AsyncMock(),
    )
    teacher = server.User(
        id="teacher-1",
        username="teacher",
        name="Teacher One",
        role="teacher",
    )

    with (
        patch.object(server, "db", SimpleNamespace(schedules=schedules)),
        patch.object(server, "_insert_changelog", new=AsyncMock()) as log_change,
    ):
        response = asyncio.run(
            server.update_teacher_schedule_note(
                "schedule-1",
                server.TeacherNoteUpdate(teacher_note="Bring lab materials"),
                teacher,
            )
        )

    schedules.update_one.assert_awaited_once()
    log_change.assert_awaited_once()
    assert response.teacher_note == "Bring lab materials"


def test_bell_schedule_response_includes_baseline_and_weekday_times():
    settings = SimpleNamespace(
        find_one=AsyncMock(
            return_value={
                "id": "break_settings",
                "start_time": "08:00",
                "dismissal_time": "12:55",
                "period_duration_minutes": 35,
                "break_after_period": 3,
                "break_duration_minutes": 15,
                "school_timezone": "Asia/Kolkata",
            }
        )
    )
    holiday_cursor = SimpleNamespace(to_list=AsyncMock(return_value=[]))
    holidays = SimpleNamespace(find=Mock(return_value=holiday_cursor))
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    with patch.object(
        server, "db", SimpleNamespace(settings=settings, holidays=holidays)
    ):
        response = asyncio.run(server.get_bell_schedule(current_user=admin))

    assert len(response.baseline_period_times) == 8
    assert response.baseline_period_times[0].start == "08:00"
    assert set(response.day_period_times) == {
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
    }


def test_admin_bell_schedule_resolves_legacy_object_id_teacher():
    teacher_object_id = ObjectId()
    teacher = {
        "id": str(teacher_object_id),
        "bell_schedule": None,
        "period_times": None,
    }
    users = SimpleNamespace(find_one=AsyncMock(side_effect=[None, teacher]))
    settings = SimpleNamespace(find_one=AsyncMock(return_value=None))
    holiday_cursor = SimpleNamespace(to_list=AsyncMock(return_value=[]))
    holidays = SimpleNamespace(find=Mock(return_value=holiday_cursor))
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )

    database = SimpleNamespace(users=users, settings=settings, holidays=holidays)
    with patch.object(server, "db", database):
        response = asyncio.run(server.get_bell_schedule(str(teacher_object_id), admin))

    assert response.configured is False
    fallback_query = users.find_one.await_args_list[1].args[0]
    assert fallback_query["$or"] == [
        {"id": teacher_object_id},
        {"_id": teacher_object_id},
    ]


def test_admin_profile_update_returns_saved_teacher_profile():
    saved_profile = {
        "id": "teacher-1",
        "username": "teacher",
        "name": "Teacher One",
        "role": "teacher",
        "designation": "Science Teacher",
        "photo_url": "https://example.com/photo.jpg",
    }
    users = SimpleNamespace(find_one_and_update=AsyncMock(return_value=saved_profile))
    schedules = SimpleNamespace(update_many=AsyncMock())
    admin = server.User(
        id="admin-1",
        username="admin",
        name="Administrator",
        role="admin",
    )
    profile_data = server.TeacherProfileUpdate(
        name="Teacher One",
        designation="Science Teacher",
        photo_url="https://example.com/photo.jpg",
    )

    with patch.object(
        server,
        "db",
        SimpleNamespace(users=users, schedules=schedules),
    ):
        response = asyncio.run(
            server.update_teacher_profile("teacher-1", profile_data, admin)
        )

    assert response.name == "Teacher One"
    assert response.designation == "Science Teacher"
    assert response.photo_url == "https://example.com/photo.jpg"
    users.find_one_and_update.assert_awaited_once()
    schedules.update_many.assert_awaited_once_with(
        {"teacher_id": "teacher-1"}, {"$set": {"teacher_name": "Teacher One"}}
    )
