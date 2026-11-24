
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomInt } from "node:crypto";

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();
const MAX_PLAYERS = 4;
const CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode() {
  let code;

  do {
    code = Array.from(
      { length: 5 },
      () => CHARACTERS[randomInt(CHARACTERS.length)]
    ).join("");
  } while (rooms.has(code));

  return code;
}

function getRoomPlayers(room) {
  return Array.from(room.players).map(([id]) => ({ id }));
}

function leaveCurrentRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;

  const room = rooms.get(code);
  socket.data.roomCode = null;

  if (!room) return;

  room.players.delete(socket.id);
  socket.leave(code);

  if (room.players.size === 0) {
    rooms.delete(code);
  } else {
    io.to(code).emit("room-updated", {
      code,
      players: getRoomPlayers(room),
      count: room.players.size,
      maxPlayers: MAX_PLAYERS
    });
  }
}

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

  socket.on("create-room", (callback) => {
    leaveCurrentRoom(socket);

    const code = generateRoomCode();
    const room = {
      players: new Set([socket.id])
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;

    const result = {
      ok: true,
      code,
      players: getRoomPlayers(room),
      count: room.players.size,
      maxPlayers: MAX_PLAYERS
    };

    socket.emit("room-updated", result);

    if (typeof callback === "function") {
      callback(result);
    }

    console.log("Sala creada:", code);
  });

  socket.on("join-room", (data, callback) => {
    const code = String(data?.code || "").trim().toUpperCase();

    if (!/^[A-Z0-9]{5}$/.test(code)) {
      if (typeof callback === "function") {
        callback({ ok: false, message: "Código de sala no válido." });
      }
      return;
    }

    const room = rooms.get(code);

    if (!room) {
      if (typeof callback === "function") {
        callback({ ok: false, message: "La sala no existe." });
      }
      return;
    }

    if (!room.players.has(socket.id) && room.players.size >= MAX_PLAYERS) {
      if (typeof callback === "function") {
        callback({ ok: false, message: "La sala está completa." });
      }
      return;
    }

    leaveCurrentRoom(socket);

    const updatedRoom = rooms.get(code);

    if (!updatedRoom || updatedRoom.players.size >= MAX_PLAYERS) {
      if (typeof callback === "function") {
        callback({ ok: false, message: "No se puede entrar en esta sala." });
      }
      return;
    }

    updatedRoom.players.add(socket.id);
    socket.join(code);
    socket.data.roomCode = code;

    const result = {
      ok: true,
      code,
      players: getRoomPlayers(updatedRoom),
      count: updatedRoom.players.size,
      maxPlayers: MAX_PLAYERS
    };

    io.to(code).emit("room-updated", result);

    if (typeof callback === "function") {
      callback(result);
    }

    console.log("Jugador unido a la sala:", code);
  });

  socket.on("leave-room", () => {
    leaveCurrentRoom(socket);
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket);
    console.log("Jugador desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
