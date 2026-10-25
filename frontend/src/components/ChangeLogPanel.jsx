import { Clock, User } from 'lucide-react';

const ChangeLogPanel = ({ changelogs }) => {
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  };

  return (
    <div className="change-log-panel glass p-4 sm:p-6 rounded-2xl h-fit">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Changes</h2>
      </div>

      {changelogs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 text-sm">No recent changes</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {changelogs.map((log, index) => (
            <div
              key={log.id || index}
              className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 space-y-2"
              data-testid={`changelog-${index}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">
                    {log.day}, Period {log.period}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatTimestamp(log.timestamp)}
                  </p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded text-xs text-orange-700 dark:text-orange-400 font-medium">
                  Updated
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Previous: </span>
                  <span className="text-gray-700 dark:text-gray-300 line-through">{log.old_value}</span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Current: </span>
                  <span className="text-green-700 dark:text-green-400 font-medium">{log.new_value}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-slate-700">
                <User className="w-3 h-3" />
                <span>Changed by {log.changed_by}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChangeLogPanel;
