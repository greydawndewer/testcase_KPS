import pytest

from schedule_timing import build_period_times, period_duration_for_schedule


def build_schedule(**changes):
    values = {
        "start_time": "08:00",
        "dismissal_time": "12:55",
        "break_after_period": 3,
        "break_duration_minutes": 15,
    }
    values.update(changes)
    return build_period_times(**values)


def test_baseline_schedule_uses_eight_equal_periods_and_exact_dismissal():
    periods = build_schedule()

    assert periods[0] == {"start": "08:00", "end": "08:35"}
    assert periods[2] == {"start": "09:10", "end": "09:45"}
    assert periods[3] == {"start": "10:00", "end": "10:35"}
    assert periods[-1]["end"] == "12:55"


def test_schedule_uses_configured_break_duration_without_adjusting_it():
    assert period_duration_for_schedule("08:00", "13:00", 20) == 35
    with pytest.raises(ValueError, match="break will not be changed automatically"):
        build_schedule(dismissal_time="13:00")


def test_break_position_recalculates_following_periods_without_changing_day_end():
    periods = build_schedule(break_after_period=4)

    assert periods[3]["end"] == "10:20"
    assert periods[4]["start"] == "10:35"
    assert periods[-1]["end"] == "12:55"


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("start_time", "08:02", "Schedule start must use five-minute increments"),
        ("dismissal_time", "12:57", "Dismissal must use five-minute increments"),
        (
            "break_duration_minutes",
            12,
            "Break duration must be 5–120 minutes in five-minute steps",
        ),
        (
            "dismissal_time",
            "12:50",
            "eight equal periods of 20–60 minutes",
        ),
        (
            "dismissal_time",
            "14:00",
            "eight equal periods of 20–60 minutes",
        ),
    ],
)
def test_schedule_rejects_inconsistent_timing(field, value, message):
    with pytest.raises(ValueError, match=message):
        build_schedule(**{field: value})


def test_break_must_be_after_period_three_or_four():
    with pytest.raises(ValueError, match="after period 3 or 4"):
        build_schedule(break_after_period=5)
