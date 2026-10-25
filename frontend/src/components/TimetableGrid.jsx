import { Fragment } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const TimetableGrid = ({ schedules, breakAfter, onCellClick, onEmptyCellClick, isRecentChange, isAdmin }) => {
  const getScheduleForCell = (day, period) => {
    return schedules.find(s => s.day === day && s.period === period);
  };

  const isBreakPeriod = (period) => {
    return period === breakAfter + 0.5;
  };

  const handleCellClick = (schedule, day, period) => {
    if (schedule && onCellClick) {
      onCellClick(schedule);
    } else if (!schedule && onEmptyCellClick && isAdmin) {
      onEmptyCellClick(day, period);
    }
  };

  const renderPeriods = () => {
    const periodsWithBreak = [];
    PERIODS.forEach(p => {
      periodsWithBreak.push(p);
      if (p === breakAfter) {
        periodsWithBreak.push(p + 0.5); // Break indicator
      }
    });
    return periodsWithBreak;
  };

  const periods = renderPeriods();

  return (
    <div className="timetable-scroll overflow-x-auto">
      <div
        className="timetable-grid grid-transition min-w-[800px]"
        style={{
          gridTemplateColumns: `120px repeat(${periods.length}, minmax(0, 1fr))`
        }}
      >
        {/* Header row */}
        <div className="timetable-cell font-semibold text-center bg-blue-50 dark:bg-blue-900/30">
          <span className="text-gray-700 dark:text-gray-300">Day / Period</span>
        </div>
        {periods.map(period => (
          <div
            key={period}
            className={`timetable-cell font-semibold text-center ${
              isBreakPeriod(period)
                ? 'bg-yellow-50 dark:bg-yellow-900/30'
                : 'bg-blue-50 dark:bg-blue-900/30'
            }`}
          >
            <span className="text-gray-700 dark:text-gray-300">
              {isBreakPeriod(period) ? 'Break' : `P${period}`}
            </span>
          </div>
        ))}

        {/* Day rows */}
        {DAYS.map(day => (
          <Fragment key={day}>
            <div
              key={`${day}-label`}
              className="timetable-cell font-semibold bg-blue-50 dark:bg-blue-900/30"
            >
              <span className="text-gray-700 dark:text-gray-300">{day}</span>
            </div>
            {periods.map(period => {
              if (isBreakPeriod(period)) {
                return (
                  <div
                    key={`${day}-break`}
                    className="timetable-cell bg-yellow-50 dark:bg-yellow-900/30 flex items-center justify-center"
                  >
                    <span className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">☕ Break</span>
                  </div>
                );
              }

              const schedule = getScheduleForCell(day, period);
              const isRecent = schedule && isRecentChange && isRecentChange(schedule.updated_at);

              return (
                <div
                  key={`${day}-${period}`}
                  onClick={() => handleCellClick(schedule, day, period)}
                  className={`timetable-cell cursor-pointer ${
                    schedule ? 'hover:shadow-md' : isAdmin ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20' : ''
                  } ${
                    isRecent ? 'schedule-change' : ''
                  }`}
                  data-testid={`cell-${day}-${period}`}
                >
                  {schedule ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {schedule.subject}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {schedule.class_name}
                      </p>
                      {!isAdmin && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                          {schedule.teacher_name}
                        </p>
                      )}
                      {isRecent && (
                        <span className="inline-block px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                          Updated
                        </span>
                      )}
                    </div>
                  ) : isAdmin ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <span className="text-2xl">+</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-xs text-gray-400 dark:text-gray-600">Free</span>
                    </div>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
};

export default TimetableGrid;
