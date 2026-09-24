import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { store } from '../store';
import { clearAuth } from '../store/slices/authSlice';
import { setGlobalError } from '../store/slices/uiSlice';
import type { ApiError } from '../types/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: false,
});

// ****Request interceptor: inject Bearer token ───────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = store.getState().auth.token;
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ****Response interceptor: normalize errors ──────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: Record<string, string[]> }>) => {
    const status = error.response?.status;
    const message = error.response?.data?.message ?? error.message ?? 'An unexpected error occurred';
    const errors = error.response?.data?.errors;

    const apiError: ApiError = { message, errors, status };

    // Dispatch global error for non-422 (validation) errors
    if (status !== 422) {
      store.dispatch(setGlobalError(apiError));
    }

    // 401 means token is invalid/expired — clear auth state
    if (status === 401) {
      store.dispatch(clearAuth());
    }

    return Promise.reject(apiError);
  },
);

export default apiClient;
