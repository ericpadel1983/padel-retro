
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomInt } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;
const TICK_RATE = 30;
const rooms = new Map();
const CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const COURT = {
  width: 1000,
  height: 600
};

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

function createBall() {
  return {
    x: 500,
    y: 300,
    vx: Math.random() > 0.5 ? 260 : -260,
    vy: Math.random() > 0.5 ? 150 : -150,
    radius: 10
  };
}

function getRoomPlayers(room) {
  return Array.from(room.players.values()).map(player => ({
    id: player.id,
    slot: player.slot,
    team: player.team,
    x: player.x,
    y: player.y
  }));
}

function getRoomResult(code, room) {
  return {
    ok: true,
    code,
    players: getRoomPlayers(room),
    count: room.players.size,
    maxPlayers: MAX_PLAYERS,
    started: room.started
  };
}

function resetGame(room) {
  room.ball = createBall();
  room.score = [0, 0];

  for (const player of room.players.values()) {
    player.input = { x: 0, y: 0 };
  }
}

function leaveCurrentRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;

  const room = rooms.get(code);
  socket.data.roomCode = null;
  socket.leave(code);

  if (!room) return;

  room.players.delete(socket.id);
  room.started = false;

  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }

  resetGame(room);

  io.to(code).emit("room-updated", {
    ...getRoomResult(code, room),
    message: "Un jugador ha salido. Esperando otro jugador."
  });
}

function addPlayer(socket, room, code) {
  const slot = room.players.size;

  const positions = [
    { x: 180, y: 200 },
    { x: 330, y: 400 },
    { x: 820, y: 200 },
    { x: 670, y: 400 }
  ];

  const position = positions[slot];

  room.players.set(socket.id, {
    id: socket.id,
    slot,
    team: slot < 2 ? "blue" : "red",
    x: position.x,
    y: position.y,
    input: { x: 0, y: 0 },
    lastHit: 0
  });

  socket.join(code);
  socket.data.roomCode = code;

  if (room.players.size === MAX_PLAYERS) {
    room.started = true;
    resetGame(room);

    io.to(code).emit("game-start", {
      message: "¡Partida 2 contra 2 iniciada!"
    });
  }

  io.to(code).emit("room-updated", getRoomResult(code, room));
}

function updateGame(room, dt) {
  const playerSpeed = 260;

  for (const player of room.players.values()) {
    const minX = player.team === "blue" ? 25 : 520;
    const maxX = player.team === "blue" ? 480 : 975;

    player.x += player.input.x * playerSpeed * dt;
    player.y += player.input.y * playerSpeed * dt;

    player.x = Math.max(minX, Math.min(maxX, player.x));
    player.y = Math.max(25, Math.min(575, player.y));
  }

  const ball = room.ball;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Rebots contra les parets
  if (ball.y - ball.radius < 15) {
    ball.y = 15 + ball.radius;
    ball.vy = Math.abs(ball.vy);
  }

  if (ball.y + ball.radius > COURT.height - 15) {
    ball.y = COURT.height - 15 - ball.radius;
    ball.vy = -Math.abs(ball.vy);
  }

  if (ball.x - ball.radius < 15) {
    ball.x = 15 + ball.radius;
    ball.vx = Math.abs(ball.vx);
  }

  if (ball.x + ball.radius > COURT.width - 15) {
    ball.x = COURT.width - 15 - ball.radius;
    ball.vx = -Math.abs(ball.vx);
  }

  // Contacte amb els quatre jugadors
  const now = Date.now();

  for (const player of room.players.values()) {
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = ball.radius + 18;

    if (distance < minDistance && now - player.lastHit > 250) {
      const angle = Math.atan2(dy, dx);

      ball.x = player.x + Math.cos(angle) * minDistance;
      ball.y = player.y + Math.sin(angle) * minDistance;

      const speed = Math.min(
        Math.sqrt(ball.vx ** 2 + ball.vy ** 2) + 15,
        480
      );

      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;

      player.lastHit = now;
    }
  }
}

// Fitxers del joc
app.use(express.static(path.resolve(__dirname, "../dist")));

app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../dist/index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    game: "Padel Retro Online",
    multiplayer: "2v2",
    maxPlayers: MAX_PLAYERS
  });
});

// Connexions Socket.IO
io.on("connection", socket => {
  console.log("Jugador conectado:", socket.id);

  socket.on("create-room", callback => {
    leaveCurrentRoom(socket);

    const code = generateRoomCode();

    const room = {
      players: new Map(),
      started: false,
      ball: createBall(),
      score: [0, 0]
    };

    rooms.set(code, room);
    addPlayer(socket, room, code);

    if (typeof callback === "function") {
      callback(getRoomResult(code, room));
    }

    console.log("Sala creada:", code);
  });

  socket.on("join-room", (data, callback) => {
    const code = String(data?.code || "")
      .trim()
      .toUpperCase();

    if (!/^[A-Z0-9]{5}$/.test(code)) {
      if (typeof callback === "function") {
        callback({
          ok: false,
          message: "Código de sala no válido."
        });
      }
      return;
    }

    const room = rooms.get(code);

    if (!room) {
      if (typeof callback === "function") {
        callback({
          ok: false,
          message: "La sala no existe."
        });
      }
      return;
    }

    if (room.players.has(socket.id)) {
      if (typeof callback === "function") {
        callback(getRoomResult(code, room));
      }
      return;
    }

    if (room.players.size >= MAX_PLAYERS) {
      if (typeof callback === "function") {
        callback({
          ok: false,
          message: "La sala está completa."
        });
      }
      return;
    }

    leaveCurrentRoom(socket);

    addPlayer(socket, room, code);

    if (typeof callback === "function") {
      callback(getRoomResult(code, room));
    }

    console.log("Jugador unido a la sala:", code);
  });

  // El mòbil envia la direcció del joystick
  socket.on("player-input", data => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);

    if (!room || !room.started) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const x = Number(data?.x);
    const y = Number(data?.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const length = Math.sqrt(x * x + y * y);
    const scale = length > 1 ? 1 / length : 1;

    player.input = {
      x: x * scale,
      y: y * scale
    };
  });

  socket.on("leave-room", () => {
    leaveCurrentRoom(socket);
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket);
    console.log("Jugador desconectado:", socket.id);
  });
});

// Motor de joc: 30 actualitzacions per segon
let lastTick = Date.now();

setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - lastTick) / 1000, 0.05);
  lastTick = now;

  for (const [code, room] of rooms) {
    if (!room.started || room.players.size !== MAX_PLAYERS) {
      continue;
    }

    updateGame(room, dt);

    io.to(code).emit("game-state", {
      players: getRoomPlayers(room),
      ball: room.ball,
      score: room.score
    });
  }
}, 1000 / TICK_RATE);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor Pádel Retro activo en puerto ${PORT}`);
});
