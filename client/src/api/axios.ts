import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(null);
  });
  failedQueue = [];
}

// Routes that should never trigger a token refresh attempt
const NO_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/me', '/auth/register'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url: string = originalRequest?.url || '';

    // Don't retry auth endpoints — just pass the error through
    if (NO_REFRESH_URLS.some((u) => url.includes(u))) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
