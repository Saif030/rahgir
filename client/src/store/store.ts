import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice";
import events from "./eventsSlice";
import itinerary from "./itinerarySlice";
import ui from "./uiSlice";

export const store = configureStore({
  reducer: { auth, events, itinerary, ui },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
