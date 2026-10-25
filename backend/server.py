import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field
from pymongo import AsyncMongoClient
from pymongo.errors import PyMongoError
from starlette.middleware.cors import CORSMiddleware

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


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    name: str
    role: str  # 'admin' or 'teacher'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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


class ScheduleEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    teacher_id: str
    teacher_name: str
    day: str  # Monday, Tuesday, etc.
    period: int  # 1-8
    subject: str
    class_name: str
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


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "break_settings"
    break_after_period: int = 3  # 3 or 4
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
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
        {"username": "t_admin", "name": "Admin", "password": "pass123"},
        {"username": "t_nadeem", "name": "Nadeem Sir", "password": "pass123"},
        {"username": "t_prinshu", "name": "Prinshu Sir", "password": "pass123"},
        {"username": "t_abhishek", "name": "Abhishek Sir", "password": "pass123"},
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
            await db.users.insert_one(user_doc)
            teacher_ids[teacher["username"]] = user.id
            logger.info(f"Teacher {teacher['name']} created")
        else:
            teacher_ids[teacher["username"]] = exists["id"]

    # Initialize settings
    settings_exists = await db.settings.find_one({"id": "break_settings"})
    if not settings_exists:
        settings = Settings()
        settings_doc = settings.model_dump()
        settings_doc["updated_at"] = settings_doc["updated_at"].isoformat()
        await db.settings.insert_one(settings_doc)
        logger.info("Settings initialized")

    # Load demo schedules if none exist
    schedule_count = await db.schedules.count_documents({})
    if schedule_count == 0:
        await load_demo_schedules()
        logger.info("Demo schedules loaded")


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
            detail="Schedule conflict: This class already has a lesson at this time",
        )

    schedule = ScheduleEntry(**schedule_data.model_dump())
    schedule_doc = schedule.model_dump()
    schedule_doc["updated_at"] = schedule_doc["updated_at"].isoformat()

    await db.schedules.insert_one(schedule_doc)
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

    # Log the change
    changes = []
    if update_data.subject and update_data.subject != existing.get("subject"):
        changes.append(f"Subject: {existing.get('subject')} → {update_data.subject}")
    if update_data.class_name and update_data.class_name != existing.get("class_name"):
        changes.append(
            f"Class: {existing.get('class_name')} → {update_data.class_name}"
        )

    if changes:
        changelog = ChangeLog(
            schedule_id=schedule_id,
            teacher_id=existing["teacher_id"],
            teacher_name=existing["teacher_name"],
            day=existing["day"],
            period=existing["period"],
            old_value=existing.get("subject", "")
            + " - "
            + existing.get("class_name", ""),
            new_value=(update_data.subject or existing.get("subject", ""))
            + " - "
            + (update_data.class_name or existing.get("class_name", "")),
            changed_by=current_user.name,
        )
        changelog_doc = changelog.model_dump()
        changelog_doc["timestamp"] = changelog_doc["timestamp"].isoformat()
        await db.changelogs.insert_one(changelog_doc)

    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.schedules.update_one({"id": schedule_id}, {"$set": update_dict})

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

    result = await db.schedules.delete_one({"id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")

    return {"message": "Schedule deleted successfully"}


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
