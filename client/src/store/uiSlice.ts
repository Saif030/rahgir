import { createSlice } from "@reduxjs/toolkit";

interface Toast {
  id: number;
  title: string;
  body?: string;
  kind: "info" | "warn" | "error";
}

let nextId = 1;

const slice = createSlice({
  name: "ui",
  initialState: { toasts: [] as Toast[], crowd: {} as Record<string, number> },
  reducers: {
    pushToast(state, action: { payload: Omit<Toast, "id"> }) {
      state.toasts.push({ ...action.payload, id: nextId++ });
      if (state.toasts.length > 5) state.toasts.shift();
    },
    dismissToast(state, action: { payload: number }) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    setCrowd(state, action: { payload: { venueId: string; density: number } }) {
      state.crowd[action.payload.venueId] = action.payload.density;
    },
    setCrowdBulk(state, action: { payload: Record<string, number> }) {
      state.crowd = { ...state.crowd, ...action.payload };
    },
  },
});

export const { pushToast, dismissToast, setCrowd, setCrowdBulk } = slice.actions;
export default slice.reducer;
