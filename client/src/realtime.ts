import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { applyRealtimeEvent, fetchEvents } from "./store/eventsSlice";
import { fetchItineraries } from "./store/itinerarySlice";
import { pushToast, setCrowd } from "./store/uiSlice";

const SOCKET_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
let socket: Socket | null = null;

export function useRealtime() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const filters = useAppSelector((s) => s.events.filters);

  useEffect(() => {
    if (socket) return;
    socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

    socket.on("event:status", (p: { eventId: string; status: string }) => {
      dispatch(applyRealtimeEvent(p));
      dispatch(
        pushToast({
          title: `Event ${p.status.toLowerCase()}`,
          body: `Event ${p.eventId} is now ${p.status}.`,
          kind: p.status === "CANCELLED" ? "error" : "warn",
        }),
      );
      void dispatch(fetchEvents(filters));
      if (user) void dispatch(fetchItineraries());
    });

    socket.on("itinerary:affected", (p: { eventId: string; status: string }) => {
      dispatch(
        pushToast({
          title: "Your itinerary is affected",
          body: `An event in your itinerary is now ${p.status}.`,
          kind: "warn",
        }),
      );
      void dispatch(fetchItineraries());
    });

    socket.on("crowd:update", (p: { venueId: string; density: number }) => {
      dispatch(setCrowd(p));
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    if (socket && user) socket.emit("subscribe:user", user.id);
  }, [user]);
}

export function subscribeVenue(venueId: string) {
  socket?.emit("subscribe:venue", venueId);
}
