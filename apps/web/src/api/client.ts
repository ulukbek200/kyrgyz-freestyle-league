import axios from 'axios';
import { useAuth } from '../store/auth';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((cfg) => {
  const t = useAuth.getState().token;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401 && useAuth.getState().token) useAuth.getState().logout();
    return Promise.reject(e);
  },
);

export const get = <T = any>(url: string, params?: any) => api.get<T>(url, { params }).then((r) => r.data);
export const errMsg = (e: any) => e?.response?.status === 429 ? 'Слишком много попыток. Попробуйте позже.' : e?.response?.data?.error ?? e?.message ?? 'Не удалось выполнить действие';
