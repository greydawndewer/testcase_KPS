const toMinutes = (value) => {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (minutes % 5 !== 0) return null;
  return hours * 60 + minutes;
};

export const periodDurationForFixedBreak = (
  startTime,
  dismissalTime,
  breakDurationMinutes,
) => {
  const start = toMinutes(startTime);
  const dismissal = toMinutes(dismissalTime);
  const breakDuration = Number(breakDurationMinutes);
  if (
    start === null
    || dismissal === null
    || dismissal <= start
    || !Number.isInteger(breakDuration)
    || breakDuration < 5
    || breakDuration > 120
    || breakDuration % 5
  ) return null;
  const remaining = dismissal - start - breakDuration;
  if (remaining <= 0 || remaining % 8 !== 0) return null;
  const duration = remaining / 8;
  if (duration < 20 || duration > 60 || duration % 5 !== 0) return null;
  return duration;
};

export const isFiveMinuteTime = (value) => toMinutes(value) !== null;
