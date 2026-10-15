import type { Server } from "socket.io";

/** Typed emit helpers. Rooms: `event:{id}`, `user:{id}`, `venue:{id}`. */
export function emitEventChanged(io: Server, eventId: string, payload: unknown) {
  io.to(`event:${eventId}`).emit("event:status", payload);
}

export function emitItineraryAffected(io: Server, userId: string, payload: unknown) {
  io.to(`user:${userId}`).emit("itinerary:affected", payload);
}

export function emitCrowd(io: Server, venueId: string, payload: unknown) {
  io.to(`venue:${venueId}`).emit("crowd:update", payload);
}

export function getIO(req: { app: { get(k: string): unknown } }): Server | null {
  const io = req.app.get("io");
  return (io as Server) ?? null;
}
