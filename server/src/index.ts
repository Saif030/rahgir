import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import { createApp, isAllowedOrigin } from "./app.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const app = createApp();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => (isAllowedOrigin(origin) ? cb(null, true) : cb(new Error("CORS blocked"))),
    credentials: true,
  },
});
app.set("io", io);

io.on("connection", (socket) => {
  socket.on("subscribe:event", (eventId: string) => socket.join(`event:${eventId}`));
  socket.on("subscribe:venue", (venueId: string) => socket.join(`venue:${venueId}`));
  socket.on("subscribe:user", (userId: string) => socket.join(`user:${userId}`));
});

server.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
