from datetime import date, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def _minutes(value: str, label: str) -> int:
    try:
        parsed = time.fromisoformat(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} must use HH:MM format") from error
    if parsed.second or parsed.microsecond:
        raise ValueError(f"{label} must use HH:MM format")
    if parsed.minute % 5:
        raise ValueError(f"{label} must use five-minute increments")
    return parsed.hour * 60 + parsed.minute


def validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (TypeError, ValueError, ZoneInfoNotFoundError) as error:
        raise ValueError(
            "Choose a valid school timezone, such as Asia/Kolkata"
        ) from error
    return value


def period_duration_for_schedule(
    start_time: str, dismissal_time: str, break_duration_minutes: int
) -> int:
    start = _minutes(start_time, "Schedule start")
    dismissal = _minutes(dismissal_time, "Dismissal")
    if dismissal <= start:
        raise ValueError("Dismissal must be after the schedule start")
    if (
        not isinstance(break_duration_minutes, int)
        or not 5 <= break_duration_minutes <= 120
        or break_duration_minutes % 5
    ):
        raise ValueError("Break duration must be 5–120 minutes in five-minute steps")
    period_minutes, remainder = divmod(dismissal - start - break_duration_minutes, 8)
    if remainder or not 20 <= period_minutes <= 60 or period_minutes % 5:
        raise ValueError(
            "The start, dismissal, and break must leave eight equal periods "
            "of 20–60 minutes in five-minute steps. Adjust those times; the "
            "break will not be changed automatically."
        )
    return period_minutes


def build_period_times(
    start_time: str,
    dismissal_time: str,
    break_after_period: int,
    break_duration_minutes: int,
) -> list[dict[str, str]]:
    period_duration_minutes = period_duration_for_schedule(
        start_time, dismissal_time, break_duration_minutes
    )
    dismissal = _minutes(dismissal_time, "Dismissal")
    if break_after_period not in (3, 4):
        raise ValueError("Break must be scheduled after period 3 or 4")
    current = _minutes(start_time, "Schedule start")
    ranges = []
    for index in range(1, 9):
        end = current + period_duration_minutes
        ranges.append(
            {
                "start": f"{current // 60:02d}:{current % 60:02d}",
                "end": f"{end // 60:02d}:{end % 60:02d}",
            }
        )
        current = end
        if index == break_after_period:
            current += break_duration_minutes

    if current != dismissal:
        raise ValueError(
            "The calculated schedule does not end at the configured dismissal time."
        )
    return ranges


def local_today(timezone_name: str, now: datetime | None = None) -> date:
    zone = ZoneInfo(validate_timezone(timezone_name))
    return (now or datetime.now(zone)).astimezone(zone).date()
