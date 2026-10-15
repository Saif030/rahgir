import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, setTokens } from "../api/client";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  status: "idle" | "loading" | "failed";
  error: string | null;
  registeredEventIds: string[];
}

const initialState: AuthState = { user: null, status: "idle", error: null, registeredEventIds: [] };

export const bootstrapAuth = createAsyncThunk("auth/bootstrap", async () => {
  if (!localStorage.getItem("er_access")) return null;
  const { data } = await api.get("/auth/me");
  return data as User;
});

export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }: { email: string; password: string }) => {
    const { data } = await api.post("/auth/login", { email, password });
    setTokens(data.accessToken, data.refreshToken);
    return data.user as User;
  },
);

export const register = createAsyncThunk(
  "auth/register",
  async (body: { name: string; email: string; password: string; role?: string }) => {
    const { data } = await api.post("/auth/register", body);
    setTokens(data.accessToken, data.refreshToken);
    return data.user as User;
  },
);

export const fetchUserRegistrations = createAsyncThunk("auth/fetchRegistrations", async () => {
  if (!localStorage.getItem("er_access")) return [];
  try {
    const { data } = await api.get("/users/history");
    return (data as { eventId: string }[]).map((r) => r.eventId);
  } catch {
    return [];
  }
});

export const logout = createAsyncThunk("auth/logout", async () => {
  const refresh = localStorage.getItem("er_refresh");
  try {
    await api.post("/auth/logout", { refreshToken: refresh });
  } catch {
    /* ignore */
  }
  setTokens(null, null);
  return null;
});

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    addRegisteredEvent(state, action: { payload: string }) {
      if (!state.registeredEventIds.includes(action.payload)) {
        state.registeredEventIds.push(action.payload);
      }
    },
  },
  extraReducers: (b) => {
    b.addCase(bootstrapAuth.fulfilled, (s, a) => {
      s.user = a.payload;
    });
    b.addCase(bootstrapAuth.rejected, (s) => {
      s.user = null;
    });
    b.addCase(login.pending, (s) => {
      s.status = "loading";
      s.error = null;
    });
    b.addCase(login.fulfilled, (s, a) => {
      s.status = "idle";
      s.user = a.payload;
    });
    b.addCase(login.rejected, (s, a) => {
      s.status = "failed";
      s.error = (a.error.message ?? "Login failed") as string;
    });
    b.addCase(register.pending, (s) => {
      s.status = "loading";
      s.error = null;
    });
    b.addCase(register.fulfilled, (s, a) => {
      s.status = "idle";
      s.user = a.payload;
    });
    b.addCase(register.rejected, (s, a) => {
      s.status = "failed";
      s.error = (a.error.message ?? "Registration failed") as string;
    });
    b.addCase(fetchUserRegistrations.fulfilled, (s, a) => {
      s.registeredEventIds = a.payload;
    });
    b.addCase(logout.fulfilled, (s) => {
      s.user = null;
      s.registeredEventIds = [];
    });
  },
});

export const { addRegisteredEvent } = slice.actions;
export default slice.reducer;
