import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../api/client";
import type { Itinerary, OptimizedRoute } from "../types";

interface ItineraryState {
  mine: Itinerary[];
  activeId: string | null;
  status: "idle" | "loading";
  route: OptimizedRoute | null;
  routeStatus: "idle" | "loading" | "failed";
  routeError: string | null;
}

const initialState: ItineraryState = {
  mine: [],
  activeId: null,
  status: "idle",
  route: null,
  routeStatus: "idle",
  routeError: null,
};

export const fetchItineraries = createAsyncThunk("it/fetch", async () => {
  const { data } = await api.get("/itineraries");
  return data as Itinerary[];
});

export const createItinerary = createAsyncThunk("it/create", async (name: string) => {
  const { data } = await api.post("/itineraries", { name });
  return data as Itinerary;
});

export const addToItinerary = createAsyncThunk(
  "it/add",
  async ({ itineraryId, eventId }: { itineraryId: string; eventId: string }) => {
    const { data } = await api.post(`/itineraries/${itineraryId}/events`, { eventId });
    return data as Itinerary;
  },
);

export const removeFromItinerary = createAsyncThunk(
  "it/remove",
  async ({ itineraryId, eventId }: { itineraryId: string; eventId: string }) => {
    const { data } = await api.delete(`/itineraries/${itineraryId}/events/${eventId}`);
    return data as Itinerary;
  },
);

export const reorderItinerary = createAsyncThunk(
  "it/reorder",
  async ({ itineraryId, order }: { itineraryId: string; order: string[] }) => {
    const { data } = await api.put(`/itineraries/${itineraryId}`, { order });
    return data as Itinerary;
  },
);

export const optimizeItinerary = createAsyncThunk(
  "it/optimize",
  async ({ eventIds, includeEateries }: { eventIds: string[]; includeEateries?: boolean }) => {
    const { data } = await api.post("/routes/optimize", { eventIds, includeEateries });
    return data as OptimizedRoute;
  },
);

function upsert(state: ItineraryState, it: Itinerary) {
  const i = state.mine.findIndex((x) => x.id === it.id);
  if (i >= 0) state.mine[i] = it;
  else state.mine.unshift(it);
  state.activeId ??= it.id;
}

const slice = createSlice({
  name: "itinerary",
  initialState,
  reducers: {
    setActive(state, action: { payload: string | null }) {
      state.activeId = action.payload;
    },
    clearRoute(state) {
      state.route = null;
      state.routeStatus = "idle";
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchItineraries.fulfilled, (s, a) => {
      s.mine = a.payload;
      if (!s.activeId && a.payload.length > 0) s.activeId = a.payload[0].id;
    });
    b.addCase(createItinerary.fulfilled, (s, a) => {
      upsert(s, a.payload);
      s.activeId = a.payload.id;
    });
    b.addCase(addToItinerary.fulfilled, (s, a) => upsert(s, a.payload));
    b.addCase(removeFromItinerary.fulfilled, (s, a) => upsert(s, a.payload));
    b.addCase(reorderItinerary.fulfilled, (s, a) => upsert(s, a.payload));
    b.addCase(optimizeItinerary.pending, (s) => {
      s.routeStatus = "loading";
      s.routeError = null;
    });
    b.addCase(optimizeItinerary.fulfilled, (s, a) => {
      s.routeStatus = "idle";
      s.route = a.payload;
    });
    b.addCase(optimizeItinerary.rejected, (s, a) => {
      s.routeStatus = "failed";
      s.routeError = a.error.message ?? "Optimization failed";
    });
  },
});

export const { setActive, clearRoute } = slice.actions;
export default slice.reducer;
