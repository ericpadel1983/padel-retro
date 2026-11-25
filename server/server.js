
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

app.get("/", (req, res) => {
  res.send("Padel Retro Online - Servidor funcionando.");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

function createCode() {
  let code;
  do {
    code = randomInt(10000, 100000).toString();
  } while (rooms.has(code));
  return code;
}

function publicPlayers(room) {
  return room.players.map((p) => ({
    id: p.id,
    slot: p.slot,
    team: p.team,
    x: p.x,
    y: p.y
  }));
}

function updateRoom(code) {
  const room = rooms.get(code);
  if (!room) return;

  io.to(code).emit("room-updated", {
    code,
    players: publicPlayers(room),
    count: room.players.length,
    started: room.started
  });
}

function startGame(room, code) {
  if (room.players.length !== 4 || room.started) return;

  room.started = true;
  room.players.forEach((p, i) => {
    p.x = i % 2 === 0 ? 300 : 700;
    p.y = i < 2 ? 180 : 420;
  });

  io.to(code).emit("game-start", {
    message: "Partida iniciada!"
  });

  updateRoom(code);
  broadcastState(code);
}

function broadcastState(code) {
  const room = rooms.get(code);
  if (!room) return;

  io.to(code).emit("game-state", {
    players: publicPlayers(room),
    ball: room.ball,
    score: room.score
  });
}

io.on("connection", (socket) => {
  socket.on("create-room", (callback) => {
    const code = createCode();

    const room = {
      players: [],
      started: false,
      ball: { x: 500, y: 300 },
      score: [0, 0]
    };

    rooms.set(code, room);
    joinPlayer(socket, code);

    callback?.({
      ok: true,
      code,
      players: publicPlayers(room)
    });
  });

  socket.on("join-room", ({ code } = {}, callback) => {
    const room = rooms.get(code);

    if (!room) {
      return callback?.({
        ok: false,
        message: "Sala no encontrada."
      });
    }

    if (room.players.length >= 4 || room.started) {
      return callback?.({
        ok: false,
        message: "La sala está llena o ya ha comenzado."
      });
    }

    joinPlayer(socket, code);

    callback?.({
      ok: true,
      code,
      players: publicPlayers(room)
    });

    if (room.players.length === 4) {
      startGame(room, code);
    }
  });

  function joinPlayer(socket, code) {
    const room = rooms.get(code);
    if (!room) return;

    const slot = room.players.length;

    room.players.push({
      id: socket.id,
      slot,
      team: slot < 2 ? "blue" : "red",
      x: slot < 2 ? 250 : 750,
      y: slot % 2 === 0 ? 180 : 420,
      input: { x: 0, y: 0 }
    });

    socket.join(code);
    socket.data.roomCode = code;

    updateRoom(code);
  }

  socket.on("player-input", ({ x, y } = {}) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || !room.started) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    player.input = {
      x: Math.max(-1, Math.min(1, Number(x) || 0)),
      y: Math.max(-1, Math.min(1, Number(y) || 0))
    };
  });

  socket.on("leave-room", () => {
    leaveRoom(socket);
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);
  });
});

function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;

  const room = rooms.get(code);
  if (room) {
    room.players = room.players.filter(
      (p) => p.id !== socket.id
    );

    if (room.players.length === 0) {
      rooms.delete(code);
    } else {
      room.started = false;
      room.players.forEach((p, i) => {
        p.slot = i;
        p.team = i < 2 ? "blue" : "red";
        p.input = { x: 0, y: 0 };
      });
      updateRoom(code);
    }
  }

  socket.leave(code);
  socket.data.roomCode = null;
}

setInterval(() => {
  for (const [code, room] of rooms) {
    if (!room.started) continue;

    for (const player of room.players) {
      player.x = Math.max(45, Math.min(955,
        player.x + player.input.x * 4
      ));

      player.y = Math.max(45, Math.min(555,
        player.y + player.input.y * 4
      ));
    }

    broadcastState(code);
  }
}, 50);

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
