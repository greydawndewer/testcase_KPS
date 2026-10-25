import axios from 'axios';

const RESPONSE_DELAY_MS = 5000;
const listeners = new Set();
const pendingRequests = new Map();
let nextRequestId = 0;
let status = { waiting: false, unavailable: false };

const publish = (nextStatus) => {
  if (
    status.waiting === nextStatus.waiting &&
    status.unavailable === nextStatus.unavailable
  ) {
    return;
  }

  status = nextStatus;
  listeners.forEach((listener) => listener());
};

const finishRequest = (requestId) => {
  if (requestId === undefined) return;

  const timer = pendingRequests.get(requestId);
  if (timer === undefined) return;

  clearTimeout(timer);
  pendingRequests.delete(requestId);
};

axios.interceptors.request.use((config) => {
  const requestId = ++nextRequestId;
  const timer = setTimeout(() => {
    if (pendingRequests.has(requestId)) {
      publish({ waiting: true, unavailable: false });
    }
  }, RESPONSE_DELAY_MS);

  pendingRequests.set(requestId, timer);
  config.backendMonitorRequestId = requestId;
  publish({ waiting: status.waiting, unavailable: false });
  return config;
});

axios.interceptors.response.use(
  (response) => {
    finishRequest(response.config.backendMonitorRequestId);
    if (pendingRequests.size === 0) {
      publish({ waiting: false, unavailable: false });
    }
    return response;
  },
  (error) => {
    finishRequest(error.config?.backendMonitorRequestId);
    if (pendingRequests.size === 0) {
      const didNotRespond =
        Boolean(error.request) &&
        !error.response &&
        error.code !== 'ERR_CANCELED';
      publish({ waiting: false, unavailable: didNotRespond });
    }
    return Promise.reject(error);
  },
);

export const subscribeToBackendStatus = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getBackendStatus = () => status;

export const dismissBackendError = () => {
  publish({ waiting: false, unavailable: false });
};
