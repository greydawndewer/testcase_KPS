import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TimetableGrid from './TimetableGrid';

describe('TimetableGrid', () => {
  it('highlights a substitution lesson in green styling', () => {
    const markup = renderToStaticMarkup(
      <TimetableGrid
        schedules={[{
          id: 'substitution-1',
          day: 'Monday',
          period: 1,
          subject: 'SUBSTITUTION',
          class_name: 'Grade 9A',
        }]}
        breakAfter={3}
        periodTimes={[]}
      />,
    );

    expect(markup).toContain('substitution-cell');
    expect(markup).toContain('SUBSTITUTION');
  });
});
