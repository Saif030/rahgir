import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../api/client";
import type { ApiEvent, Venue } from "../types";

export interface EventFilters {
  search: string;
  category: string;
  date: string;
  time: string;
  capacity: string;
  difficulty: string;
}

interface EventsState {
  items: ApiEvent[];
  total: number;
  status: "idle" | "loading" | "failed";
  view: "list" | "grid";
  filters: EventFilters;
}

const initialState: EventsState = {
  items: [],
  total: 0,
  status: "idle",
  view: "grid",
  filters: { search: "", category: "", date: "", time: "", capacity: "", difficulty: "" },
};

export const fetchEvents = createAsyncThunk("events/fetch", async (filters: EventFilters) => {
  const params: Record<string, string> = { limit: "100" };
  if (filters.search) params.search = filters.search;
  if (filters.category) params.category = filters.category;
  if (filters.date) params.date = filters.date;
  if (filters.time) params.time = filters.time;
  if (filters.capacity) params.capacity = filters.capacity;
  if (filters.difficulty) params.difficulty = filters.difficulty;
  const { data } = await api.get("/events", { params });
  return data as { total: number; data: ApiEvent[] };
});

export const fetchVenues = createAsyncThunk("events/venues", async () => {
  const { data } = await api.get("/venues");
  return data as Venue[];
});

interface FullState {
  events: EventsState;
  venues: { items: Venue[] };
}

const slice = createSlice({
  name: "events",
  initialState: { ...initialState, venues: [] as Venue[] } as EventsState & { venues: Venue[] },
  reducers: {
    setFilters(state, action: { payload: Partial<EventFilters> }) {
      state.filters = { ...state.filters, ...action.payload };
    },
    setView(state, action: { payload: "list" | "grid" }) {
      state.view = action.payload;
    },
    applyRealtimeEvent(state, action: { payload: { eventId: string; status: string } }) {
      const ev = state.items.find((e) => e.id === action.payload.eventId);
      if (ev) ev.status = action.payload.status as ApiEvent["status"];
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchEvents.pending, (s) => {
      s.status = "loading";
    });
    b.addCase(fetchEvents.fulfilled, (s, a) => {
      s.status = "idle";
      s.items = a.payload.data;
      s.total = a.payload.total;
    });
    b.addCase(fetchEvents.rejected, (s) => {
      s.status = "failed";
    });
    b.addCase(fetchVenues.fulfilled, (s, a) => {
      s.venues = a.payload;
    });
  },
});

export const { setFilters, setView, applyRealtimeEvent } = slice.actions;
export default slice.reducer;
export type { FullState };
