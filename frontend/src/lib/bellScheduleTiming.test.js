import { describe, expect, it } from 'vitest';
import {
  isFiveMinuteTime,
  periodDurationForFixedBreak,
} from './bellScheduleTiming';

describe('bell schedule timing helpers', () => {
  it('derives baseline duration without changing the configured break', () => {
    expect(isFiveMinuteTime('08:05')).toBe(true);
    expect(isFiveMinuteTime('08:07')).toBe(false);
    expect(periodDurationForFixedBreak('08:00', '12:55', 15)).toBe(35);
    expect(periodDurationForFixedBreak('08:00', '13:00', 20)).toBe(35);
    expect(periodDurationForFixedBreak('08:00', '12:50', 15)).toBeNull();
    expect(periodDurationForFixedBreak('08:00', '13:00', 15)).toBeNull();
  });
});
