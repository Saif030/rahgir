import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 15000 });

let accessToken: string | null = localStorage.getItem("er_access") ?? null;
let refreshToken: string | null = localStorage.getItem("er_refresh") ?? null;

export function setTokens(a: string | null, r: string | null) {
  accessToken = a;
  refreshToken = r;
  if (a) localStorage.setItem("er_access", a);
  else localStorage.removeItem("er_access");
  if (r) localStorage.setItem("er_refresh", r);
  else localStorage.removeItem("er_refresh");
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (err.response?.status === 401 && original && !original._retried && refreshToken) {
      original._retried = true;
      refreshing ??= axios
        .post(`${API_URL}/api/auth/refresh`, { refreshToken })
        .then((r) => {
          setTokens(r.data.accessToken, r.data.refreshToken);
          return r.data.accessToken as string;
        })
        .catch(() => {
          setTokens(null, null);
          return null;
        })
        .finally(() => {
          refreshing = null;
        });
      const next = await refreshing;
      if (next) {
        original.headers.Authorization = `Bearer ${next}`;
        return api.request(original);
      }
    }
    throw err;
  },
);
