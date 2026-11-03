import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BellScheduleConfigFields from './BellScheduleConfigFields';

const value = {
  startTime: '08:00',
  dismissalTime: '12:55',
  periodDurationMinutes: 35,
  schoolTimezone: 'Asia/Kolkata',
  breakAfterPeriod: 3,
  breakDurationMinutes: 15,
};

describe('BellScheduleConfigFields', () => {
  it('shows a derived baseline and allows school timing fields to be configured', () => {
    const markup = renderToStaticMarkup(
      <BellScheduleConfigFields
        value={value}
        onChange={() => {}}
        prefix="test"
        periodDurationMinutes={35}
        includeBreak
      />,
    );

    expect(markup).toContain('First period starts');
    expect(markup).toContain('Dismissal');
    expect(markup).toContain('School timezone (IANA)');
    expect(markup).toContain('Calculated period duration');
    expect(markup).toContain('35 minutes');
    expect(markup).not.toContain('Period duration</label>');
    expect(markup).toContain('Break duration');
  });

  it('renders the calculated duration as read-only', () => {
    const markup = renderToStaticMarkup(
      <BellScheduleConfigFields
        value={value}
        onChange={() => {}}
        prefix="test"
        periodDurationMinutes={null}
      />,
    );

    expect(markup).toContain('Not valid');
  });
});
