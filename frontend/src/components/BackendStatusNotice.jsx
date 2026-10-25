import { useSyncExternalStore } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import {
  dismissBackendError,
  getBackendStatus,
  subscribeToBackendStatus,
} from '../lib/backendRequestMonitor';

const BackendStatusNotice = () => {
  const status = useSyncExternalStore(
    subscribeToBackendStatus,
    getBackendStatus,
    getBackendStatus,
  );

  if (!status.waiting && !status.unavailable) return null;

  return (
    <div className="backend-status-overlay">
      <section
        aria-labelledby="backend-status-title"
        aria-modal="true"
        className="backend-status-card"
        role={status.unavailable ? 'alertdialog' : 'dialog'}
      >
        {status.unavailable ? (
          <AlertTriangle className="h-10 w-10 text-amber-500" aria-hidden="true" />
        ) : (
          <LoaderCircle className="h-10 w-10 animate-spin text-blue-600" aria-hidden="true" />
        )}
        <h2 id="backend-status-title" className="text-xl font-semibold text-gray-900 dark:text-white">
          {status.unavailable ? 'Server did not respond' : 'Connecting to the server'}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {status.unavailable
            ? 'The app could not reach its backend. It may be waking from sleep, or the service may be temporarily unavailable. Check your connection and try again.'
            : 'The request is taking longer than usual. The backend may be waking from sleep. Please keep this page open; this notice will close when the server responds.'}
        </p>
        {status.unavailable && (
          <button
            className="backend-status-dismiss"
            onClick={dismissBackendError}
            type="button"
          >
            Close notice
          </button>
        )}
      </section>
    </div>
  );
};

export default BackendStatusNotice;
