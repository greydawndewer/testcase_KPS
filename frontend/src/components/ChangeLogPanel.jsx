import { ArrowDown, Clock, User } from 'lucide-react';

const ChangeLogPanel = ({ changelogs }) => {
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Time unavailable';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 0) {
      return date.toLocaleString();
    }
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  };

  return (
    <section
      className="change-log-panel glass p-4 sm:p-6 rounded-2xl"
      aria-labelledby="change-log-heading"
      data-testid="change-log-panel"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          </div>
          <div>
            <h2 id="change-log-heading" className="text-xl font-semibold text-gray-900 dark:text-white">
              Schedule updates
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Changes made to your timetable by the administrator
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 dark:border-slate-700 dark:text-gray-300">
          {changelogs.length} {changelogs.length === 1 ? 'update' : 'updates'}
        </span>
      </div>

      {changelogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center dark:border-slate-700">
          <p className="font-medium text-gray-700 dark:text-gray-300">No schedule updates yet</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Updates for your timetable will appear here.
          </p>
        </div>
      ) : (
        <ol className="grid gap-3 md:grid-cols-2" aria-label="Recent timetable updates">
          {changelogs.map((log, index) => {
            const actionLabel = {
              added: 'Lesson added',
              removed: 'Lesson removed',
              updated: 'Lesson updated',
            }[log.action] || 'Lesson updated';

            return (
              <li
                key={log.id || `${log.schedule_id}-${log.timestamp}-${index}`}
                className="rounded-xl border border-gray-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-800/80"
                data-testid={`changelog-${index}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {log.day}, Period {log.period}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400" title={new Date(log.timestamp).toLocaleString()}>
                      {formatTimestamp(log.timestamp)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-slate-700 dark:text-gray-200">
                    {actionLabel}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="min-w-0 rounded-lg bg-gray-50 p-3 dark:bg-slate-900/70">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Before
                    </p>
                    <p className="break-words text-gray-700 dark:text-gray-300">
                      {log.old_value || 'No lesson'}
                    </p>
                  </div>
                  <ArrowDown className="mx-auto h-4 w-4 text-gray-400 sm:rotate-[-90deg]" aria-hidden="true" />
                  <div className="min-w-0 rounded-lg bg-gray-50 p-3 dark:bg-slate-900/70">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      After
                    </p>
                    <p className="break-words font-medium text-gray-900 dark:text-white">
                      {log.new_value || 'No lesson'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-slate-700 dark:text-gray-400">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Changed by {log.changed_by}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default ChangeLogPanel;
