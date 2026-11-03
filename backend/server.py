import logging
import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

import bcrypt
import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field
from pymongo import AsyncMongoClient, ReturnDocument
from pymongo.errors import PyMongoError
from starlette.middleware.cors import CORSMiddleware

from schedule_timing import (
    build_period_times,
    local_today,
    period_duration_for_schedule,
    validate_timezone,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client: AsyncMongoClient = AsyncMongoClient(
    mongo_url,
    serverSelectionTimeoutMS=8000,
)
db = client[os.environ["DB_NAME"]]

# Security setup
security = HTTPBearer()
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        logger.info("Connecting to MongoDB...")
        try:
            await client.admin.command("ping")
            await db.announcements.create_index(
                "expires_at",
                expireAfterSeconds=0,
                name="announcement_expiry",
            )
            await _delete_expired_announcements()
            await init_demo_data()
        except PyMongoError as error:
            logger.exception(
                "MongoDB connection or demo-data initialization failed. "
                "Check MONGO_URL, DB_NAME, and MongoDB network access."
            )
            raise RuntimeError(
                "Backend startup failed because MongoDB could not be reached or "
                "initialized. Check backend/.env and MongoDB network access."
            ) from error
        yield
    finally:
        await client.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# ============ Models ============


class PeriodTime(BaseModel):
    start: str = ""
    end: str = ""


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    name: str
    role: str  # 'admin' or 'teacher'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    photo_url: Optional[str] = None
    designation: Optional[str] = None
    school_start_date: Optional[str] = None
    school_end_date: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    period_times: Optional[List[PeriodTime]] = None
    bell_schedule: Optional[dict] = None


class TeacherProfileUpdate(BaseModel):
    name: Optional[str] = None
    photo_url: Optional[str] = None
    designation: Optional[str] = None
    school_start_date: Optional[str] = None
    school_end_date: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None


class BellScheduleUpdate(BaseModel):
    start_time: str
    dismissal_time: str
    break_after_period: int
    break_duration_minutes: int
    school_timezone: str = "Asia/Kolkata"


class TeacherBellScheduleUpdate(BaseModel):
    start_time: str
    dismissal_time: str


class BellSchedule(BaseModel):
    start_time: str = ""
    dismissal_time: str = ""
    period_duration_minutes: int = 35
    school_timezone: str = "Asia/Kolkata"
    break_after_period: int = 3
    break_duration_minutes: int = 15
    baseline_period_times: List[PeriodTime] = Field(
        default_factory=lambda: [PeriodTime() for _ in range(8)]
    )
    period_times: List[PeriodTime] = Field(
        default_factory=lambda: [PeriodTime() for _ in range(8)]
    )
    day_period_times: Dict[str, List[PeriodTime]] = Field(default_factory=dict)
    week_dates: Dict[str, str] = Field(default_factory=dict)
    holidays: List[dict] = Field(default_factory=list)
    today: str = ""
    configured: bool = False
    is_custom: bool = False


class HolidayCreate(BaseModel):
    day: date
    name: str
    note: str = ""


class HolidayUpdate(BaseModel):
    day: Optional[date] = None
    name: Optional[str] = None
    note: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = "teacher"


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    token: str
    user: User


class DemoTeacherAccount(BaseModel):
    name: str
    username: str


class SubjectOption(BaseModel):
    id: str
    name: str


class SubjectOptionCreate(BaseModel):
    name: str


class GradeOption(BaseModel):
    id: str
    standard: str
    section: str
    name: str


class GradeOptionCreate(BaseModel):
    standard: str
    section: str


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=20000)


class ScheduleEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    teacher_id: str
    teacher_name: str
    day: str  # Monday, Tuesday, etc.
    period: int  # 1-8
    subject: str
    class_name: str
    teacher_note: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ScheduleCreate(BaseModel):
    teacher_id: str
    teacher_name: str
    day: str
    period: int
    subject: str
    class_name: str


class ScheduleUpdate(BaseModel):
    subject: Optional[str] = None
    class_name: Optional[str] = None
    teacher_id: Optional[str] = None
    teacher_name: Optional[str] = None
    teacher_note: Optional[str] = None


LEGACY_SEEDED_SUBJECT_IDS = [
    "algebra",
    "calculus",
    "chemistry",
    "creative-writing",
    "drama",
    "economics",
    "english",
    "english-literature",
    "geography",
    "geometry",
    "history",
    "lab-session",
    "mathematics",
    "physics",
    "science",
    "social-studies",
    "statistics",
    "world-history",
]

LEGACY_SEEDED_GRADE_IDS = [
    f"grade-{standard}--{section}"
    for standard in range(9, 13)
    for section in ("a", "b")
]


def _catalog_id(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")


def _grade_name(standard: str, section: str) -> str:
    if section == "General":
        return standard
    if re.fullmatch(r"Grade\s*\d+", standard, re.IGNORECASE):
        return f"{standard}{section}"
    return f"{standard}-{section}"


def _schedule_summary(subject: str, class_name: str, teacher_name: str) -> str:
    return " · ".join(
        f"{label}: {value}"
        for label, value in (
            ("Subject", subject),
            ("Class", class_name),
            ("Teacher", teacher_name),
        )
        if value
    )


async def _insert_changelog(**values):
    changelog = ChangeLog(**values)
    document = changelog.model_dump()
    document["timestamp"] = document["timestamp"].isoformat()
    await db.changelogs.insert_one(document)


async def _save_subject_option(name: str) -> dict:
    normalized_name = name.strip()
    if normalized_name.casefold() == "substitution":
        normalized_name = "SUBSTITUTION"
    option_id = _catalog_id(normalized_name)
    option = {"id": option_id, "name": normalized_name}
    await db.catalog_subjects.update_one(
        {"id": option_id}, {"$set": option}, upsert=True
    )
    return option


async def _save_grade_option(standard: str, section: str) -> dict:
    normalized_standard = standard.strip()
    normalized_section = section.strip()
    option_id = f"{_catalog_id(normalized_standard)}--{_catalog_id(normalized_section)}"
    option = {
        "id": option_id,
        "standard": normalized_standard,
        "section": normalized_section,
        "name": _grade_name(normalized_standard, normalized_section),
    }
    await db.catalog_grades.update_one({"id": option_id}, {"$set": option}, upsert=True)
    return option


async def _save_schedule_catalog_values(
    subject: Optional[str] = None, class_name: Optional[str] = None
):
    if subject is not None and subject.strip():
        await _save_subject_option(subject)

    if class_name is not None and class_name.strip():
        grade_match = re.fullmatch(
            r"(Grade\s*\d+)\s*[- ]?\s*([A-Za-z])",
            class_name.strip(),
            re.IGNORECASE,
        )
        if not grade_match:
            grade_match = re.fullmatch(
                r"((?:Standard\s*)?[IVXLCDM]+)\s*[- ]\s*([A-Za-z])",
                class_name.strip(),
                re.IGNORECASE,
            )
        if grade_match:
            await _save_grade_option(grade_match.group(1), grade_match.group(2).upper())
        else:
            await _save_grade_option(class_name.strip(), "General")


async def _initialize_schedule_catalog():
    await _save_subject_option("SUBSTITUTION")
    migration = await db.catalog_metadata.find_one({"id": "schedule_catalog_v2"})
    if migration:
        return

    await db.catalog_subjects.delete_many({"id": {"$in": LEGACY_SEEDED_SUBJECT_IDS}})
    await db.catalog_grades.delete_many({"id": {"$in": LEGACY_SEEDED_GRADE_IDS}})
    await db.catalog_metadata.insert_one({"id": "schedule_catalog_v2"})


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "break_settings"
    break_after_period: int = 3  # 3 or 4
    break_duration_minutes: int = 15
    start_time: str = ""
    dismissal_time: str = ""
    period_duration_minutes: int = 35
    school_timezone: str = "Asia/Kolkata"
    period_times: List[PeriodTime] = Field(
        default_factory=lambda: [PeriodTime() for _ in range(8)]
    )
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChangeLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    schedule_id: str
    teacher_id: str
    teacher_name: str
    day: str
    period: int
    old_value: str
    new_value: str
    changed_by: str
    action: str = "updated"
    update_type: str = "lesson"
    headline: str = "Schedule updated"
    details: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TeacherNoteUpdate(BaseModel):
    teacher_note: str = Field(max_length=1000)


# ============ Helper Functions ============


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("ascii"),
        )
    except (UnicodeEncodeError, ValueError):
        return False


def _minutes_after_midnight(value: str) -> int:
    try:
        parsed = time.fromisoformat(value)
    except ValueError as error:
        raise HTTPException(
            status_code=400, detail=f"Invalid time '{value}'. Use HH:MM."
        ) from error
    if parsed.second or parsed.microsecond:
        raise HTTPException(
            status_code=400, detail=f"Invalid time '{value}'. Use HH:MM."
        )
    if parsed.minute % 5:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time '{value}'. Minutes must be in five-minute steps.",
        )
    return parsed.hour * 60 + parsed.minute


def validate_period_times(
    period_times: List[PeriodTime],
    break_after_period: int,
    break_duration_minutes: int,
):
    if len(period_times) != 8:
        raise HTTPException(
            status_code=400, detail="Exactly eight period time ranges are required"
        )
    if break_after_period not in (3, 4):
        raise HTTPException(
            status_code=400, detail="Break must be scheduled after period 3 or 4"
        )
    if (
        not isinstance(break_duration_minutes, int)
        or not 5 <= break_duration_minutes <= 120
        or break_duration_minutes % 5
    ):
        raise HTTPException(
            status_code=400,
            detail="Break duration must be 5–120 minutes in five-minute steps",
        )

    ranges = []
    for period_number, period in enumerate(period_times, start=1):
        if not period.start or not period.end:
            raise HTTPException(
                status_code=400,
                detail=f"Start and end times are required for period {period_number}",
            )
        start = _minutes_after_midnight(period.start)
        end = _minutes_after_midnight(period.end)
        if start >= end:
            raise HTTPException(
                status_code=400,
                detail=f"Period {period_number} must end after it starts",
            )
        ranges.append((start, end))

    for index in range(1, len(ranges)):
        previous_end = ranges[index - 1][1]
        start = ranges[index][0]
        expected_gap = break_duration_minutes if index == break_after_period else 0
        if start - previous_end != expected_gap:
            if expected_gap:
                message = (
                    f"Periods {index} and {index + 1} must have exactly "
                    f"{break_duration_minutes} minutes for the break"
                )
            else:
                message = f"Period {index + 1} must start when period {index} ends"
            raise HTTPException(status_code=400, detail=message)


WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday")


def _config_from_settings(settings: Settings) -> dict:
    duration = settings.period_duration_minutes
    if settings.start_time and settings.dismissal_time:
        try:
            duration = period_duration_for_schedule(
                settings.start_time,
                settings.dismissal_time,
                settings.break_duration_minutes,
            )
        except ValueError:
            pass
    return {
        "start_time": settings.start_time,
        "dismissal_time": settings.dismissal_time,
        "period_duration_minutes": duration,
        "break_after_period": settings.break_after_period,
        "break_duration_minutes": settings.break_duration_minutes,
        "school_timezone": settings.school_timezone,
    }


async def _find_teacher_for_bell_schedule(teacher_id: str) -> Optional[dict]:
    teacher = await db.users.find_one(
        {"id": teacher_id, "role": "teacher"},
        {"_id": 0, "id": 1, "period_times": 1, "bell_schedule": 1},
    )
    if teacher or not ObjectId.is_valid(teacher_id):
        return teacher

    object_id = ObjectId(teacher_id)
    return await db.users.find_one(
        {
            "role": "teacher",
            "$or": [{"id": object_id}, {"_id": object_id}],
        },
        {"_id": 0, "id": 1, "period_times": 1, "bell_schedule": 1},
    )


def _validate_bell_config(config: dict):
    try:
        validate_timezone(config["school_timezone"])
        build_period_times(
            config["start_time"],
            config["dismissal_time"],
            config["break_after_period"],
            config["break_duration_minutes"],
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


def _week_dates(today: date) -> dict[str, date]:
    monday = today - timedelta(days=today.weekday())
    return {
        weekday: monday + timedelta(days=index)
        for index, weekday in enumerate(WEEKDAYS)
    }


def _period_times_for_day(config: dict) -> list[PeriodTime]:
    try:
        ranges = build_period_times(
            config["start_time"],
            config["dismissal_time"],
            config["break_after_period"],
            config["break_duration_minutes"],
        )
    except ValueError as error:
        raise HTTPException(
            status_code=409,
            detail=f"Saved timetable is inconsistent: {error}",
        ) from error
    return [PeriodTime(**period) for period in ranges]


def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")

        if isinstance(user_doc.get("created_at"), str):
            user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ============ Initialize Demo Data ============


async def init_demo_data():
    # Check if admin exists
    admin_exists = await db.users.find_one({"username": "admin123"})
    if not admin_exists:
        admin_user = User(username="admin123", name="Administrator", role="admin")
        admin_doc = admin_user.model_dump()
        admin_doc["created_at"] = admin_doc["created_at"].isoformat()
        admin_doc["password_hash"] = hash_password("password123")
        await db.users.insert_one(admin_doc)
        logger.info("Admin user created")

    # Create demo teachers
    demo_teachers = [
        {
            "username": "t_admin",
            "name": "Admin",
            "password": "pass123",
            "show_on_login": False,
        },
        {
            "username": "t_nadeem",
            "name": "Nadeem Sir",
            "password": "pass123",
            "show_on_login": True,
        },
        {
            "username": "t_prinshu",
            "name": "Prinshu Sir",
            "password": "pass123",
            "show_on_login": True,
        },
        {
            "username": "t_abhishek",
            "name": "Abhishek Sir",
            "password": "pass123",
            "show_on_login": True,
        },
    ]

    teacher_ids = {}
    for teacher in demo_teachers:
        exists = await db.users.find_one({"username": teacher["username"]})
        if not exists:
            user = User(
                username=teacher["username"], name=teacher["name"], role="teacher"
            )
            user_doc = user.model_dump()
            user_doc["created_at"] = user_doc["created_at"].isoformat()
            user_doc["password_hash"] = hash_password(teacher["password"])
            user_doc["is_demo_teacher"] = teacher["show_on_login"]
            await db.users.insert_one(user_doc)
            teacher_ids[teacher["username"]] = user.id
            logger.info(f"Teacher {teacher['name']} created")
        else:
            await db.users.update_one(
                {"id": exists["id"]},
                {"$set": {"is_demo_teacher": teacher["show_on_login"]}},
            )
            teacher_ids[teacher["username"]] = exists["id"]

    # Initialize settings
    settings_exists = await db.settings.find_one({"id": "break_settings"})
    if not settings_exists:
        settings = Settings()
        settings_doc = settings.model_dump()
        settings_doc["updated_at"] = settings_doc["updated_at"].isoformat()
        await db.settings.insert_one(settings_doc)
        logger.info("Settings initialized")

    await _initialize_schedule_catalog()


async def load_demo_schedules():
    """Load comprehensive demo timetable data for all teachers"""

    # Get all teachers
    teachers = await db.users.find({"role": "teacher"}, {"_id": 0}).to_list(100)

    # Demo schedule templates - realistic school subjects
    demo_schedules = {
        "ABC Sir": [
            # Monday
            {
                "day": "Monday",
                "period": 1,
                "subject": "Mathematics",
                "class_name": "Grade 10A",
            },
            {
                "day": "Monday",
                "period": 2,
                "subject": "Mathematics",
                "class_name": "Grade 10B",
            },
            {
                "day": "Monday",
                "period": 3,
                "subject": "Algebra",
                "class_name": "Grade 11A",
            },
            {
                "day": "Monday",
                "period": 4,
                "subject": "Statistics",
                "class_name": "Grade 12A",
            },
            {
                "day": "Monday",
                "period": 5,
                "subject": "Mathematics",
                "class_name": "Grade 9A",
            },
            # Tuesday
            {
                "day": "Tuesday",
                "period": 1,
                "subject": "Calculus",
                "class_name": "Grade 12B",
            },
            {
                "day": "Tuesday",
                "period": 2,
                "subject": "Mathematics",
                "class_name": "Grade 10A",
            },
            {
                "day": "Tuesday",
                "period": 4,
                "subject": "Geometry",
                "class_name": "Grade 11B",
            },
            {
                "day": "Tuesday",
                "period": 5,
                "subject": "Mathematics",
                "class_name": "Grade 9B",
            },
            # Wednesday
            {
                "day": "Wednesday",
                "period": 1,
                "subject": "Mathematics",
                "class_name": "Grade 10B",
            },
            {
                "day": "Wednesday",
                "period": 2,
                "subject": "Algebra",
                "class_name": "Grade 11A",
            },
            {
                "day": "Wednesday",
                "period": 4,
                "subject": "Mathematics",
                "class_name": "Grade 9A",
            },
            {
                "day": "Wednesday",
                "period": 5,
                "subject": "Statistics",
                "class_name": "Grade 12A",
            },
            # Thursday
            {
                "day": "Thursday",
                "period": 1,
                "subject": "Mathematics",
                "class_name": "Grade 10A",
            },
            {
                "day": "Thursday",
                "period": 2,
                "subject": "Calculus",
                "class_name": "Grade 12B",
            },
            {
                "day": "Thursday",
                "period": 4,
                "subject": "Mathematics",
                "class_name": "Grade 9B",
            },
            {
                "day": "Thursday",
                "period": 5,
                "subject": "Geometry",
                "class_name": "Grade 11B",
            },
            # Friday
            {
                "day": "Friday",
                "period": 1,
                "subject": "Mathematics",
                "class_name": "Grade 10B",
            },
            {
                "day": "Friday",
                "period": 2,
                "subject": "Mathematics",
                "class_name": "Grade 9A",
            },
            {
                "day": "Friday",
                "period": 4,
                "subject": "Algebra",
                "class_name": "Grade 11A",
            },
        ],
        "Nadeem Sir": [
            # Monday
            {
                "day": "Monday",
                "period": 1,
                "subject": "Physics",
                "class_name": "Grade 11A",
            },
            {
                "day": "Monday",
                "period": 2,
                "subject": "Physics",
                "class_name": "Grade 12A",
            },
            {
                "day": "Monday",
                "period": 4,
                "subject": "Chemistry",
                "class_name": "Grade 10A",
            },
            {
                "day": "Monday",
                "period": 5,
                "subject": "Science",
                "class_name": "Grade 9A",
            },
            # Tuesday
            {
                "day": "Tuesday",
                "period": 1,
                "subject": "Chemistry",
                "class_name": "Grade 11B",
            },
            {
                "day": "Tuesday",
                "period": 2,
                "subject": "Physics",
                "class_name": "Grade 12B",
            },
            {
                "day": "Tuesday",
                "period": 3,
                "subject": "Lab Session",
                "class_name": "Grade 11A",
            },
            {
                "day": "Tuesday",
                "period": 5,
                "subject": "Science",
                "class_name": "Grade 9B",
            },
            # Wednesday
            {
                "day": "Wednesday",
                "period": 1,
                "subject": "Physics",
                "class_name": "Grade 11A",
            },
            {
                "day": "Wednesday",
                "period": 2,
                "subject": "Chemistry",
                "class_name": "Grade 10A",
            },
            {
                "day": "Wednesday",
                "period": 4,
                "subject": "Physics",
                "class_name": "Grade 12A",
            },
            {
                "day": "Wednesday",
                "period": 5,
                "subject": "Science",
                "class_name": "Grade 9A",
            },
            # Thursday
            {
                "day": "Thursday",
                "period": 1,
                "subject": "Chemistry",
                "class_name": "Grade 11B",
            },
            {
                "day": "Thursday",
                "period": 2,
                "subject": "Physics",
                "class_name": "Grade 12B",
            },
            {
                "day": "Thursday",
                "period": 4,
                "subject": "Lab Session",
                "class_name": "Grade 12A",
            },
            {
                "day": "Thursday",
                "period": 5,
                "subject": "Science",
                "class_name": "Grade 9B",
            },
            # Friday
            {
                "day": "Friday",
                "period": 1,
                "subject": "Physics",
                "class_name": "Grade 11A",
            },
            {
                "day": "Friday",
                "period": 2,
                "subject": "Chemistry",
                "class_name": "Grade 10A",
            },
            {
                "day": "Friday",
                "period": 4,
                "subject": "Science",
                "class_name": "Grade 9A",
            },
        ],
        "Prinshu Sir": [
            # Monday
            {
                "day": "Monday",
                "period": 1,
                "subject": "English Literature",
                "class_name": "Grade 11A",
            },
            {
                "day": "Monday",
                "period": 2,
                "subject": "English",
                "class_name": "Grade 9A",
            },
            {
                "day": "Monday",
                "period": 4,
                "subject": "Creative Writing",
                "class_name": "Grade 12A",
            },
            {
                "day": "Monday",
                "period": 5,
                "subject": "English",
                "class_name": "Grade 10A",
            },
            # Tuesday
            {
                "day": "Tuesday",
                "period": 1,
                "subject": "English",
                "class_name": "Grade 9B",
            },
            {
                "day": "Tuesday",
                "period": 2,
                "subject": "English Literature",
                "class_name": "Grade 11B",
            },
            {
                "day": "Tuesday",
                "period": 4,
                "subject": "English",
                "class_name": "Grade 10B",
            },
            {
                "day": "Tuesday",
                "period": 5,
                "subject": "Drama",
                "class_name": "Grade 12B",
            },
            # Wednesday
            {
                "day": "Wednesday",
                "period": 1,
                "subject": "English",
                "class_name": "Grade 9A",
            },
            {
                "day": "Wednesday",
                "period": 2,
                "subject": "English Literature",
                "class_name": "Grade 11A",
            },
            {
                "day": "Wednesday",
                "period": 4,
                "subject": "English",
                "class_name": "Grade 10A",
            },
            {
                "day": "Wednesday",
                "period": 5,
                "subject": "Creative Writing",
                "class_name": "Grade 12A",
            },
            # Thursday
            {
                "day": "Thursday",
                "period": 1,
                "subject": "English",
                "class_name": "Grade 9B",
            },
            {
                "day": "Thursday",
                "period": 2,
                "subject": "English Literature",
                "class_name": "Grade 11B",
            },
            {
                "day": "Thursday",
                "period": 4,
                "subject": "English",
                "class_name": "Grade 10B",
            },
            {
                "day": "Thursday",
                "period": 5,
                "subject": "Drama",
                "class_name": "Grade 12B",
            },
            # Friday
            {
                "day": "Friday",
                "period": 1,
                "subject": "English",
                "class_name": "Grade 9A",
            },
            {
                "day": "Friday",
                "period": 2,
                "subject": "English",
                "class_name": "Grade 10A",
            },
            {
                "day": "Friday",
                "period": 4,
                "subject": "English Literature",
                "class_name": "Grade 11A",
            },
        ],
        "Abhishek Sir": [
            # Monday
            {
                "day": "Monday",
                "period": 1,
                "subject": "History",
                "class_name": "Grade 10A",
            },
            {
                "day": "Monday",
                "period": 2,
                "subject": "Geography",
                "class_name": "Grade 9A",
            },
            {
                "day": "Monday",
                "period": 4,
                "subject": "World History",
                "class_name": "Grade 11A",
            },
            {
                "day": "Monday",
                "period": 5,
                "subject": "Social Studies",
                "class_name": "Grade 12A",
            },
            # Tuesday
            {
                "day": "Tuesday",
                "period": 1,
                "subject": "History",
                "class_name": "Grade 10B",
            },
            {
                "day": "Tuesday",
                "period": 2,
                "subject": "Geography",
                "class_name": "Grade 9B",
            },
            {
                "day": "Tuesday",
                "period": 4,
                "subject": "World History",
                "class_name": "Grade 11B",
            },
            {
                "day": "Tuesday",
                "period": 5,
                "subject": "Economics",
                "class_name": "Grade 12B",
            },
            # Wednesday
            {
                "day": "Wednesday",
                "period": 1,
                "subject": "History",
                "class_name": "Grade 10A",
            },
            {
                "day": "Wednesday",
                "period": 2,
                "subject": "Geography",
                "class_name": "Grade 9A",
            },
            {
                "day": "Wednesday",
                "period": 4,
                "subject": "World History",
                "class_name": "Grade 11A",
            },
            {
                "day": "Wednesday",
                "period": 5,
                "subject": "Social Studies",
                "class_name": "Grade 12A",
            },
            # Thursday
            {
                "day": "Thursday",
                "period": 1,
                "subject": "History",
                "class_name": "Grade 10B",
            },
            {
                "day": "Thursday",
                "period": 2,
                "subject": "Geography",
                "class_name": "Grade 9B",
            },
            {
                "day": "Thursday",
                "period": 4,
                "subject": "World History",
                "class_name": "Grade 11B",
            },
            {
                "day": "Thursday",
                "period": 5,
                "subject": "Economics",
                "class_name": "Grade 12B",
            },
            # Friday
            {
                "day": "Friday",
                "period": 1,
                "subject": "History",
                "class_name": "Grade 10A",
            },
            {
                "day": "Friday",
                "period": 2,
                "subject": "Geography",
                "class_name": "Grade 9A",
            },
            {
                "day": "Friday",
                "period": 4,
                "subject": "World History",
                "class_name": "Grade 11A",
            },
        ],
    }

    # Create schedules for each teacher
    for teacher in teachers:
        teacher_name = teacher["name"]
        if teacher_name in demo_schedules:
            for schedule_data in demo_schedules[teacher_name]:
                schedule = ScheduleEntry(
                    teacher_id=teacher["id"],
                    teacher_name=teacher_name,
                    day=schedule_data["day"],
                    period=schedule_data["period"],
                    subject=schedule_data["subject"],
                    class_name=schedule_data["class_name"],
                )
                schedule_doc = schedule.model_dump()
                schedule_doc["updated_at"] = schedule_doc["updated_at"].isoformat()
                await db.schedules.insert_one(schedule_doc)


# ============ Auth Routes ============


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"username": credentials.username}, {"_id": 0})

    if not user_doc or not verify_password(
        credentials.password, user_doc.get("password_hash", "")
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

    user = User(**{k: v for k, v in user_doc.items() if k != "password_hash"})
    token = create_token(user.id, user.username, user.role)

    return TokenResponse(token=token, user=user)


@api_router.get("/auth/demo-teachers", response_model=List[DemoTeacherAccount])
async def get_demo_teachers():
    """Return the public demo teacher names and usernames, never credentials."""
    teachers = await db.users.find(
        {"role": "teacher", "is_demo_teacher": True},
        {"_id": 0, "name": 1, "username": 1},
    ).to_list(20)
    return teachers


@api_router.get("/auth/verify")
async def verify_token(current_user: User = Depends(get_current_user)):
    return {"valid": True, "user": current_user}


# ============ User Routes ============


@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    for user in users:
        if isinstance(user.get("created_at"), str):
            user["created_at"] = datetime.fromisoformat(user["created_at"])
    return users


@api_router.get("/users/me", response_model=User)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@api_router.put("/users/{user_id}/profile", response_model=User)
async def update_teacher_profile(
    user_id: str,
    profile_data: TeacherProfileUpdate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    profile = profile_data.model_dump(exclude_unset=True)
    if not profile:
        raise HTTPException(status_code=400, detail="No profile changes provided")
    if profile.get("name") is not None and not profile["name"].strip():
        raise HTTPException(status_code=400, detail="Teacher name cannot be empty")
    if "name" in profile:
        profile["name"] = profile["name"].strip()
    if profile.get("bio") and len(profile["bio"]) > 1000:
        raise HTTPException(
            status_code=400, detail="Profile information cannot exceed 1000 characters"
        )
    if profile.get("photo_url"):
        if not profile["photo_url"].startswith(("https://", "http://")):
            raise HTTPException(
                status_code=400, detail="Photo URL must use HTTP or HTTPS"
            )
    try:
        start_date = (
            date.fromisoformat(profile["school_start_date"])
            if profile.get("school_start_date")
            else None
        )
        end_date = (
            date.fromisoformat(profile["school_end_date"])
            if profile.get("school_end_date")
            else None
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400, detail="School dates must use YYYY-MM-DD format"
        ) from error
    if start_date and end_date and end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="School end date cannot be before the start date",
        )

    updated = await db.users.find_one_and_update(
        {"id": user_id, "role": "teacher"},
        {"$set": profile},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0, "password_hash": 0},
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if "name" in profile:
        await db.schedules.update_many(
            {"teacher_id": user_id}, {"$set": {"teacher_name": profile["name"]}}
        )
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    return User(**updated)


@api_router.post("/users", response_model=User)
async def create_user(
    user_data: UserCreate, current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Check if username exists
    exists = await db.users.find_one({"username": user_data.username})
    if exists:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(username=user_data.username, name=user_data.name, role=user_data.role)

    user_doc = user.model_dump()
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    user_doc["password_hash"] = hash_password(user_data.password)

    await db.users.insert_one(user_doc)
    return user


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete associated schedules
    await db.schedules.delete_many({"teacher_id": user_id})

    return {"message": "User deleted successfully"}


# ============ Schedule Routes ============


@api_router.get("/catalog")
async def get_schedule_catalog(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    subjects = await db.catalog_subjects.find({}, {"_id": 0}).to_list(1000)
    grades = await db.catalog_grades.find({}, {"_id": 0}).to_list(1000)
    return {
        "subjects": sorted(subjects, key=lambda option: option["name"].casefold()),
        "grades": sorted(
            grades,
            key=lambda option: (
                option["standard"].casefold(),
                option["section"].casefold(),
            ),
        ),
    }


@api_router.post("/catalog/subjects", response_model=SubjectOption)
async def create_subject_option(
    option_data: SubjectOptionCreate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if not option_data.name.strip():
        raise HTTPException(status_code=400, detail="Subject name cannot be empty")

    return await _save_subject_option(option_data.name)


@api_router.delete("/catalog/subjects/{option_id}")
async def delete_subject_option(
    option_id: str, current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if option_id == _catalog_id("SUBSTITUTION"):
        raise HTTPException(
            status_code=400, detail="SUBSTITUTION is a permanent subject"
        )
    result = await db.catalog_subjects.delete_one({"id": option_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"message": "Subject removed from the catalog"}


@api_router.post("/catalog/grades", response_model=GradeOption)
async def create_grade_option(
    option_data: GradeOptionCreate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if not option_data.standard.strip() or not option_data.section.strip():
        raise HTTPException(
            status_code=400, detail="Standard and section cannot be empty"
        )

    return await _save_grade_option(option_data.standard, option_data.section)


@api_router.delete("/catalog/grades/{option_id}")
async def delete_grade_option(
    option_id: str, current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.catalog_grades.delete_one({"id": option_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Grade not found")
    return {"message": "Grade removed from the catalog"}


@api_router.get("/announcements")
async def list_announcements(current_user: User = Depends(get_current_user)):
    await _delete_expired_announcements()
    announcements = db.announcements.find({}, {"_id": 0}).sort("created_at", -1)
    return await announcements.to_list(500)


async def _delete_expired_announcements():
    now = datetime.now(timezone.utc)
    legacy_expiry = (now - timedelta(days=7)).isoformat()
    await db.announcements.delete_many(
        {
            "$or": [
                {"expires_at": {"$lte": now}},
                {
                    "expires_at": {"$exists": False},
                    "created_at": {"$lt": legacy_expiry},
                },
            ]
        }
    )


@api_router.post("/announcements")
async def create_announcement(
    announcement_data: AnnouncementCreate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    title = announcement_data.title.strip()
    body = announcement_data.body.strip()
    if not title or not body:
        raise HTTPException(
            status_code=400, detail="Title and announcement cannot be empty"
        )
    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(days=7)
    announcement_document = {
        "id": str(uuid.uuid4()),
        "title": title,
        "body": body,
        "created_by": current_user.name,
        "created_at": created_at.isoformat(),
        "expires_at": expires_at,
    }
    response_document = {
        **announcement_document,
        "expires_at": expires_at.isoformat(),
    }
    try:
        await db.announcements.insert_one(announcement_document)
    except PyMongoError as error:
        announcement_id = announcement_document["id"]
        logger.exception("Could not save announcement %s", announcement_id)
        raise HTTPException(
            status_code=503,
            detail=(
                "Announcement could not be saved. Check the database connection "
                "and try again."
            ),
        ) from error
    return response_document


@api_router.delete("/announcements")
async def delete_latest_announcements(
    count: int = Query(ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await _delete_expired_announcements()
    latest = (
        await db.announcements.find({}, {"_id": 0, "id": 1})
        .sort("created_at", -1)
        .limit(count)
        .to_list(count)
    )
    announcement_ids = [item["id"] for item in latest]
    if not announcement_ids:
        return {"deleted_count": 0}
    announcement_filter = {"id": {"$in": announcement_ids}}
    result = await db.announcements.delete_many(announcement_filter)
    return {"deleted_count": result.deleted_count}


@api_router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: str, current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.announcements.delete_one({"id": announcement_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"message": "Announcement removed"}


@api_router.get("/settings/bell-schedule", response_model=BellSchedule)
async def get_bell_schedule(
    teacher_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    settings_doc = await db.settings.find_one({"id": "break_settings"}, {"_id": 0})
    settings = Settings(**(settings_doc or {}))
    config = _config_from_settings(settings)
    legacy_times = settings.period_times
    is_custom = False

    if current_user.role == "teacher":
        teacher_doc = await db.users.find_one(
            {"id": current_user.id},
            {"_id": 0, "period_times": 1, "bell_schedule": 1},
        )
        if teacher_doc and teacher_doc.get("bell_schedule"):
            config.update(teacher_doc["bell_schedule"])
            is_custom = True
        elif teacher_doc and teacher_doc.get("period_times"):
            legacy_times = [PeriodTime(**item) for item in teacher_doc["period_times"]]
            is_custom = True
    elif teacher_id:
        teacher_doc = await _find_teacher_for_bell_schedule(teacher_id)
        if not teacher_doc:
            raise HTTPException(status_code=404, detail="Teacher not found")
        if teacher_doc.get("bell_schedule"):
            config.update(teacher_doc["bell_schedule"])
            is_custom = True
        elif teacher_doc.get("period_times"):
            legacy_times = [PeriodTime(**item) for item in teacher_doc["period_times"]]
            is_custom = True

    configured = bool(config["start_time"] and config["dismissal_time"])
    timezone_name = config["school_timezone"] or "Asia/Kolkata"
    try:
        today = local_today(timezone_name)
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    week_dates = _week_dates(today)

    day_period_times = {}
    if configured:
        _validate_bell_config(config)
        day_period_times = {
            weekday: _period_times_for_day(config) for weekday in WEEKDAYS
        }
        effective_times = day_period_times[WEEKDAYS[today.weekday()]]
    else:
        effective_times = legacy_times
        day_period_times = {weekday: legacy_times for weekday in WEEKDAYS}

    holidays = await db.holidays.find({}, {"_id": 0}).to_list(500)
    week_start = week_dates[WEEKDAYS[0]]
    week_end = week_dates[WEEKDAYS[-1]]
    visible_holidays = [
        holiday
        for holiday in holidays
        if today <= date.fromisoformat(holiday["day"]) <= week_end
        and week_start <= date.fromisoformat(holiday["day"])
    ]
    return BellSchedule(
        start_time=config["start_time"],
        dismissal_time=config["dismissal_time"],
        period_duration_minutes=(
            period_duration_for_schedule(
                config["start_time"],
                config["dismissal_time"],
                config["break_duration_minutes"],
            )
            if configured
            else config["period_duration_minutes"]
        ),
        school_timezone=timezone_name,
        break_after_period=settings.break_after_period,
        break_duration_minutes=settings.break_duration_minutes,
        baseline_period_times=(
            _period_times_for_day(config) if configured else legacy_times
        ),
        period_times=effective_times,
        day_period_times=day_period_times,
        week_dates={
            weekday: value.isoformat() for weekday, value in week_dates.items()
        },
        holidays=visible_holidays,
        today=WEEKDAYS[today.weekday()],
        configured=configured,
        is_custom=is_custom,
    )


@api_router.put("/settings/bell-schedule", response_model=BellSchedule)
async def update_default_bell_schedule(
    schedule_data: BellScheduleUpdate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    update = schedule_data.model_dump()
    update["school_timezone"] = validate_timezone(update["school_timezone"])
    candidate = {
        key: update[key]
        for key in (
            "start_time",
            "dismissal_time",
            "break_after_period",
            "break_duration_minutes",
            "school_timezone",
        )
    }
    _validate_bell_config(candidate)
    candidate["period_duration_minutes"] = period_duration_for_schedule(
        candidate["start_time"],
        candidate["dismissal_time"],
        candidate["break_duration_minutes"],
    )

    teachers = await db.users.find(
        {"role": "teacher"}, {"_id": 0, "id": 1, "name": 1, "bell_schedule": 1}
    ).to_list(1000)
    for teacher in teachers:
        effective = {**candidate, **(teacher.get("bell_schedule") or {})}
        effective["break_after_period"] = candidate["break_after_period"]
        effective["break_duration_minutes"] = candidate["break_duration_minutes"]
        _validate_bell_config(effective)

    old_settings = await db.settings.find_one({"id": "break_settings"}, {"_id": 0})
    old_config = _config_from_settings(Settings(**(old_settings or {})))
    update["period_duration_minutes"] = period_duration_for_schedule(
        candidate["start_time"],
        candidate["dismissal_time"],
        candidate["break_duration_minutes"],
    )
    update["period_times"] = [
        period.model_dump() for period in _period_times_for_day(candidate)
    ]
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"id": "break_settings"}, {"$set": update}, upsert=True
    )

    if old_config != candidate:
        for teacher in teachers:
            await _insert_changelog(
                schedule_id=f"bell-schedule-{uuid.uuid4()}",
                teacher_id=teacher["id"],
                teacher_name=teacher["name"],
                day="All weekdays",
                period=0,
                old_value=str(old_config),
                new_value=str(candidate),
                changed_by=current_user.name,
                action="updated",
                update_type="bell_schedule",
                headline="Baseline timetable updated",
                details=(
                    "The administrator updated the default school-day timing. "
                    "Your effective period ranges have been recalculated."
                ),
            )
    return await get_bell_schedule(current_user=current_user)


@api_router.put("/users/{user_id}/bell-schedule", response_model=BellSchedule)
async def update_teacher_bell_schedule(
    user_id: str,
    schedule_data: TeacherBellScheduleUpdate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings_doc = await db.settings.find_one({"id": "break_settings"}, {"_id": 0})
    settings = Settings(**(settings_doc or {}))
    config = _config_from_settings(settings)
    config.update(schedule_data.model_dump())
    config["break_after_period"] = settings.break_after_period
    config["break_duration_minutes"] = settings.break_duration_minutes
    _validate_bell_config(config)
    teacher = await db.users.find_one(
        {"id": user_id, "role": "teacher"}, {"_id": 0, "id": 1, "name": 1}
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    period_duration = period_duration_for_schedule(
        config["start_time"],
        config["dismissal_time"],
        config["break_duration_minutes"],
    )
    saved_schedule = {
        **schedule_data.model_dump(),
        "period_duration_minutes": period_duration,
    }
    generated_times = _period_times_for_day(config)
    result = await db.users.update_one(
        {"id": user_id, "role": "teacher"},
        {
            "$set": {
                "bell_schedule": saved_schedule,
                "period_times": [item.model_dump() for item in generated_times],
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    await _insert_changelog(
        schedule_id=f"bell-schedule-{uuid.uuid4()}",
        teacher_id=user_id,
        teacher_name=teacher["name"],
        day="All weekdays",
        period=0,
        old_value="Previous teacher timing",
        new_value=str(saved_schedule),
        changed_by=current_user.name,
        update_type="bell_schedule",
        headline="Teacher timetable baseline updated",
        details=(
            "The administrator updated your personal start and dismissal. "
            "Period duration is calculated from the school break."
        ),
    )
    return await get_bell_schedule(teacher_id=user_id, current_user=current_user)


@api_router.delete("/users/{user_id}/bell-schedule")
async def reset_teacher_bell_schedule(
    user_id: str, current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.users.update_one(
        {"id": user_id, "role": "teacher"},
        {"$unset": {"period_times": "", "bell_schedule": ""}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    teacher = await db.users.find_one(
        {"id": user_id, "role": "teacher"}, {"_id": 0, "name": 1}
    )
    await _insert_changelog(
        schedule_id=f"bell-schedule-{uuid.uuid4()}",
        teacher_id=user_id,
        teacher_name=teacher["name"],
        day="All weekdays",
        period=0,
        old_value="Custom teacher timing",
        new_value="Default school timing",
        changed_by=current_user.name,
        update_type="bell_schedule",
        headline="Teacher timetable reset to default",
        details=(
            "The administrator reset your start, dismissal, and period duration to "
            "school defaults."
        ),
    )
    return {"message": "Teacher now uses the default bell schedule"}


@api_router.get("/schedules", response_model=List[ScheduleEntry])
async def get_schedules(
    teacher_id: Optional[str] = None, current_user: User = Depends(get_current_user)
):
    query = {}
    if current_user.role == "teacher":
        query["teacher_id"] = current_user.id
    elif teacher_id:
        query["teacher_id"] = teacher_id

    schedules = await db.schedules.find(query, {"_id": 0}).to_list(1000)
    for schedule in schedules:
        if isinstance(schedule.get("updated_at"), str):
            schedule["updated_at"] = datetime.fromisoformat(schedule["updated_at"])

    return schedules


@api_router.post("/schedules", response_model=ScheduleEntry)
async def create_schedule(
    schedule_data: ScheduleCreate, current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Check for conflicts
    conflict = await db.schedules.find_one(
        {
            "day": schedule_data.day,
            "period": schedule_data.period,
            "class_name": schedule_data.class_name,
        }
    )

    if conflict:
        raise HTTPException(
            status_code=400,
            detail=("Schedule conflict: This class already has a lesson at this time"),
        )

    schedule = ScheduleEntry(**schedule_data.model_dump())
    schedule_doc = schedule.model_dump()
    schedule_doc["updated_at"] = schedule_doc["updated_at"].isoformat()

    await db.schedules.insert_one(schedule_doc)
    changelog = ChangeLog(
        schedule_id=schedule.id,
        teacher_id=schedule.teacher_id,
        teacher_name=schedule.teacher_name,
        day=schedule.day,
        period=schedule.period,
        old_value="No lesson",
        new_value=_schedule_summary(
            schedule.subject, schedule.class_name, schedule.teacher_name
        ),
        changed_by=current_user.name,
        action="added",
        update_type="lesson_added",
        headline="Period added",
        details=_schedule_summary(
            schedule.subject, schedule.class_name, schedule.teacher_name
        ),
    )
    changelog_doc = changelog.model_dump()
    changelog_doc["timestamp"] = changelog_doc["timestamp"].isoformat()
    await db.changelogs.insert_one(changelog_doc)
    await _save_schedule_catalog_values(schedule_data.subject, schedule_data.class_name)
    return schedule


@api_router.put("/schedules/{schedule_id}", response_model=ScheduleEntry)
async def update_schedule(
    schedule_id: str,
    update_data: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Schedule not found")

    update_dict = {
        key: value
        for key, value in update_data.model_dump(exclude_unset=True).items()
        if value is not None
    }

    if "teacher_id" in update_dict:
        teacher_doc = await db.users.find_one(
            {"id": update_dict["teacher_id"], "role": "teacher"}, {"_id": 0}
        )
        if not teacher_doc:
            raise HTTPException(status_code=404, detail="Teacher not found")
        update_dict["teacher_name"] = teacher_doc["name"]
    elif "teacher_name" in update_dict:
        update_dict.pop("teacher_name")

    new_class_name = update_dict.get("class_name", existing.get("class_name"))
    if new_class_name != existing.get("class_name"):
        conflict = await db.schedules.find_one(
            {
                "day": existing["day"],
                "period": existing["period"],
                "class_name": new_class_name,
                "id": {"$ne": schedule_id},
            }
        )
        if conflict:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Schedule conflict: This class already has a lesson " "at this time"
                ),
            )

    # Log the change
    changes = []
    if "subject" in update_dict and update_dict["subject"] != existing.get("subject"):
        changes.append(f"Subject: {existing.get('subject')} → {update_dict['subject']}")
    if "class_name" in update_dict and update_dict["class_name"] != existing.get(
        "class_name"
    ):
        changes.append(
            f"Class: {existing.get('class_name')} → {update_dict['class_name']}"
        )
    if "teacher_id" in update_dict and update_dict["teacher_id"] != existing.get(
        "teacher_id"
    ):
        changes.append(
            f"Teacher: {existing.get('teacher_name')} → {update_dict['teacher_name']}"
        )

    changelog_docs = []
    if changes:
        new_teacher_id = update_dict.get("teacher_id", existing["teacher_id"])
        new_teacher_name = update_dict.get("teacher_name", existing["teacher_name"])
        old_value = _schedule_summary(
            existing.get("subject", ""),
            existing.get("class_name", ""),
            existing.get("teacher_name", ""),
        )
        new_value = _schedule_summary(
            update_dict.get("subject", existing.get("subject", "")),
            update_dict.get("class_name", existing.get("class_name", "")),
            new_teacher_name,
        )
        change_targets = [
            (new_teacher_id, new_teacher_name),
        ]
        if new_teacher_id != existing["teacher_id"]:
            change_targets.insert(0, (existing["teacher_id"], existing["teacher_name"]))

        for teacher_id, teacher_name in change_targets:
            changelog = ChangeLog(
                schedule_id=schedule_id,
                teacher_id=teacher_id,
                teacher_name=teacher_name,
                day=existing["day"],
                period=existing["period"],
                old_value=old_value,
                new_value=new_value,
                changed_by=current_user.name,
                update_type="lesson_details",
                headline="Period details updated",
                details=" · ".join(changes),
            )
            changelog_doc = changelog.model_dump()
            changelog_doc["timestamp"] = changelog_doc["timestamp"].isoformat()
            changelog_docs.append(changelog_doc)

    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.schedules.update_one({"id": schedule_id}, {"$set": update_dict})
        for changelog_doc in changelog_docs:
            await db.changelogs.insert_one(changelog_doc)
        await _save_schedule_catalog_values(
            subject=update_dict.get("subject"),
            class_name=update_dict.get("class_name"),
        )

    updated = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if updated is None:
        raise HTTPException(
            status_code=500, detail="Updated schedule could not be retrieved"
        )

    if isinstance(updated.get("updated_at"), str):
        updated["updated_at"] = datetime.fromisoformat(updated["updated_at"])

    return ScheduleEntry(**updated)


@api_router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: str, current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    schedule = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    result = await db.schedules.delete_one({"id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")

    changelog = ChangeLog(
        schedule_id=schedule_id,
        teacher_id=schedule["teacher_id"],
        teacher_name=schedule["teacher_name"],
        day=schedule["day"],
        period=schedule["period"],
        old_value=_schedule_summary(
            schedule.get("subject", ""),
            schedule.get("class_name", ""),
            schedule.get("teacher_name", ""),
        ),
        new_value="No lesson",
        changed_by=current_user.name,
        action="removed",
        update_type="lesson_removed",
        headline="Period removed",
        details=_schedule_summary(
            schedule.get("subject", ""),
            schedule.get("class_name", ""),
            schedule.get("teacher_name", ""),
        ),
    )
    changelog_doc = changelog.model_dump()
    changelog_doc["timestamp"] = changelog_doc["timestamp"].isoformat()
    await db.changelogs.insert_one(changelog_doc)

    return {"message": "Schedule deleted successfully"}


@api_router.put("/schedules/{schedule_id}/note", response_model=ScheduleEntry)
async def update_teacher_schedule_note(
    schedule_id: str,
    note_data: TeacherNoteUpdate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=403, detail="Only the assigned teacher can edit a lesson note"
        )
    schedule = await db.schedules.find_one(
        {"id": schedule_id, "teacher_id": current_user.id}, {"_id": 0}
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Assigned period not found")
    old_note = schedule.get("teacher_note", "")
    new_note = note_data.teacher_note.strip()
    if len(new_note) > 1000:
        raise HTTPException(
            status_code=400, detail="Lesson note cannot exceed 1000 characters"
        )
    if old_note == new_note:
        if isinstance(schedule.get("updated_at"), str):
            schedule["updated_at"] = datetime.fromisoformat(schedule["updated_at"])
        return ScheduleEntry(**schedule)

    await db.schedules.update_one(
        {"id": schedule_id, "teacher_id": current_user.id},
        {"$set": {"teacher_note": new_note}},
    )
    schedule["teacher_note"] = new_note
    if isinstance(schedule.get("updated_at"), str):
        schedule["updated_at"] = datetime.fromisoformat(schedule["updated_at"])
    await _insert_changelog(
        schedule_id=schedule_id,
        teacher_id=current_user.id,
        teacher_name=current_user.name,
        day=schedule["day"],
        period=schedule["period"],
        old_value=old_note or "No teacher note",
        new_value=new_note or "Teacher note removed",
        changed_by=current_user.name,
        update_type="teacher_note",
        headline="Lesson note updated",
        details="The teacher changed the private note for this period.",
    )
    return ScheduleEntry(**schedule)


# ============ Settings Routes ============


@api_router.get("/settings/break-period")
async def get_break_settings():
    settings = await db.settings.find_one({"id": "break_settings"}, {"_id": 0})
    if not settings:
        settings = Settings().model_dump()
        settings["updated_at"] = settings["updated_at"].isoformat()
        await db.settings.insert_one(settings)

    if isinstance(settings.get("updated_at"), str):
        settings["updated_at"] = datetime.fromisoformat(settings["updated_at"])

    return Settings(**settings)


@api_router.put("/settings/break-period")
async def update_break_settings(
    break_after: int, current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if break_after not in [3, 4]:
        raise HTTPException(
            status_code=400, detail="Break can only be after period 3 or 4"
        )

    settings_doc = await db.settings.find_one({"id": "break_settings"}, {"_id": 0})
    settings = Settings(**(settings_doc or {}))
    candidate = _config_from_settings(settings)
    candidate["break_after_period"] = break_after
    if candidate["start_time"] and candidate["dismissal_time"]:
        return await update_default_bell_schedule(
            BellScheduleUpdate(**candidate),
            current_user,
        )

    if any(period.start or period.end for period in settings.period_times):
        validate_period_times(
            settings.period_times,
            break_after,
            settings.break_duration_minutes,
        )

    overrides = await db.users.find(
        {"role": "teacher", "period_times": {"$exists": True}},
        {"_id": 0, "id": 1, "name": 1, "period_times": 1, "bell_schedule": 1},
    ).to_list(1000)
    for teacher in overrides:
        if teacher.get("bell_schedule"):
            teacher_config = {**candidate, **teacher["bell_schedule"]}
            teacher_config["break_after_period"] = break_after
            _validate_bell_config(teacher_config)
        else:
            validate_period_times(
                [PeriodTime(**item) for item in teacher["period_times"]],
                break_after,
                settings.break_duration_minutes,
            )

    await db.settings.update_one(
        {"id": "break_settings"},
        {
            "$set": {
                "break_after_period": break_after,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )

    return {"break_after_period": break_after}


def _validate_holiday_date(day: date, timezone_name: str):
    today = local_today(timezone_name)
    week_dates = _week_dates(today)
    if day.weekday() not in range(5) or day < today or day > week_dates[WEEKDAYS[-1]]:
        raise HTTPException(
            status_code=400,
            detail="Choose today or a future Monday–Friday date in the current week.",
        )


async def _log_holiday_change(holiday: dict, admin: User, action: str):
    teachers = await db.users.find(
        {"role": "teacher"}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(1000)
    for teacher in teachers:
        await _insert_changelog(
            schedule_id=f"holiday-{holiday['id']}",
            teacher_id=teacher["id"],
            teacher_name=teacher["name"],
            day=holiday["day"],
            period=0,
            old_value=(
                "Regular school day" if action == "added" else holiday.get("name", "")
            ),
            new_value=(
                holiday.get("name", "Regular school day")
                if action != "removed"
                else "Regular school day"
            ),
            changed_by=admin.name,
            action="removed" if action == "removed" else "updated",
            update_type="holiday",
            headline={
                "added": "Holiday added",
                "updated": "Holiday updated",
                "removed": "Holiday removed",
            }[action],
            details=holiday.get("note", "") or holiday.get("name", ""),
        )


@api_router.get("/holidays")
async def get_holidays(current_user: User = Depends(get_current_user)):
    settings_doc = await db.settings.find_one({"id": "break_settings"}, {"_id": 0})
    timezone_name = Settings(**(settings_doc or {})).school_timezone
    today = local_today(timezone_name)
    friday = _week_dates(today)[WEEKDAYS[-1]]
    await db.holidays.delete_many({"day": {"$lt": today.isoformat()}})
    holidays = await db.holidays.find({}, {"_id": 0}).sort("day", 1).to_list(500)
    return [
        holiday
        for holiday in holidays
        if today <= date.fromisoformat(holiday["day"]) <= friday
    ]


@api_router.post("/holidays")
async def create_holiday(
    holiday_data: HolidayCreate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings_doc = await db.settings.find_one({"id": "break_settings"}, {"_id": 0})
    timezone_name = Settings(**(settings_doc or {})).school_timezone
    _validate_holiday_date(holiday_data.day, timezone_name)
    if not holiday_data.name.strip():
        raise HTTPException(status_code=400, detail="Holiday name cannot be empty")
    existing = await db.holidays.find_one({"day": holiday_data.day.isoformat()})
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A holiday already exists for that date. Edit it instead.",
        )
    holiday = {
        "id": str(uuid.uuid4()),
        "day": holiday_data.day.isoformat(),
        "name": holiday_data.name.strip(),
        "note": holiday_data.note.strip(),
        "created_by": current_user.name,
    }
    response_holiday = holiday.copy()
    await db.holidays.insert_one(holiday)
    await _log_holiday_change(holiday, current_user, "added")
    return response_holiday


@api_router.put("/holidays/{holiday_id}")
async def update_holiday(
    holiday_id: str,
    holiday_data: HolidayUpdate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    holiday = await db.holidays.find_one({"id": holiday_id}, {"_id": 0})
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    update = holiday_data.model_dump(exclude_unset=True)
    if "day" in update:
        settings_doc = await db.settings.find_one({"id": "break_settings"}, {"_id": 0})
        _validate_holiday_date(
            update["day"], Settings(**(settings_doc or {})).school_timezone
        )
        update["day"] = update["day"].isoformat()
        conflict = await db.holidays.find_one(
            {"day": update["day"], "id": {"$ne": holiday_id}}
        )
        if conflict:
            raise HTTPException(
                status_code=409, detail="A holiday already exists for that date."
            )
    if "name" in update:
        update["name"] = update["name"].strip()
        if not update["name"]:
            raise HTTPException(status_code=400, detail="Holiday name cannot be empty")
    if "note" in update:
        update["note"] = update["note"].strip()
    await db.holidays.update_one({"id": holiday_id}, {"$set": update})
    holiday.update(update)
    await _log_holiday_change(holiday, current_user, "updated")
    return holiday


@api_router.delete("/holidays/{holiday_id}")
async def delete_holiday(
    holiday_id: str, current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    holiday = await db.holidays.find_one({"id": holiday_id}, {"_id": 0})
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    result = await db.holidays.delete_one({"id": holiday_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    await _log_holiday_change(holiday, current_user, "removed")
    return {"message": "Holiday removed"}


# ============ Changelog Routes ============


@api_router.get("/changelogs", response_model=List[ChangeLog])
async def get_changelogs(
    teacher_id: Optional[str] = None, current_user: User = Depends(get_current_user)
):
    query = {}
    if current_user.role == "teacher":
        query["teacher_id"] = current_user.id
    elif teacher_id:
        query["teacher_id"] = teacher_id

    changelogs = (
        await db.changelogs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(100)
    )
    for log in changelogs:
        if isinstance(log.get("timestamp"), str):
            log["timestamp"] = datetime.fromisoformat(log["timestamp"])

    return changelogs


@api_router.delete("/changelogs/{log_id}")
async def delete_changelog(log_id: str, current_user: User = Depends(get_current_user)):
    query = {"id": log_id}
    if current_user.role == "teacher":
        query["teacher_id"] = current_user.id
    result = await db.changelogs.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Update not found")
    return {"message": "Update removed"}


@api_router.delete("/changelogs")
async def clear_changelogs(
    teacher_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "teacher":
        teacher_id = current_user.id
    elif not teacher_id:
        raise HTTPException(
            status_code=400, detail="Choose a teacher whose updates should be cleared"
        )

    result = await db.changelogs.delete_many({"teacher_id": teacher_id})
    return {"message": "Updates cleared", "deleted_count": result.deleted_count}


# ============ Demo Data Routes ============


@api_router.post("/demo/load-schedules")
async def load_demo_schedules_endpoint(current_user: User = Depends(get_current_user)):
    """Load comprehensive demo timetable data for all teachers (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Clear existing schedules
    await db.schedules.delete_many({})
    await db.changelogs.delete_many({})

    # Load demo data
    await load_demo_schedules()

    return {"message": "Demo schedules loaded successfully", "status": "success"}


@api_router.post("/demo/clear-schedules")
async def clear_all_schedules(current_user: User = Depends(get_current_user)):
    """Clear all schedules and changelogs (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    await db.schedules.delete_many({})
    await db.changelogs.delete_many({})

    return {"message": "All schedules cleared successfully", "status": "success"}


# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
