
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get("/", (req, res) => {
  res.send("Padel Retro Online - Servidor activo 🎾");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    game: "Padel Retro Online"
  });
});

io.on("connection", (socket) => {
  console.log("Jugador conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("Jugador desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
