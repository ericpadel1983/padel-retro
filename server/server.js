
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
  res.json({
    ok: true,
    rooms: rooms.size,
    connections: io.engine.clientsCount
  });
});

function createCode() {
  let code;
  do {
    code = randomInt(10000, 100000).toString();
  } while (rooms.has(code));
  return code;
}

function publicPlayers(room) {
  return room.players.map(p => ({
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

function broadcastState(code) {
  const room = rooms.get(code);
  if (!room) return;

  io.to(code).emit("game-state", {
    players: publicPlayers(room),
    ball: room.ball,
    score: room.score
  });
}

function positionPlayers(room) {
  room.players.forEach(p => {
    p.x = p.team === "blue" ? 300 : 700;
    p.y = p.slot % 2 === 0 ? 180 : 420;
    p.input = { x: 0, y: 0 };
  });
}

function resetBall(room) {
  room.ball = {
    x: room.serverTeam === "blue" ? 300 : 700,
    y: 300,
    vx: 0,
    vy: 0,
    moving: false
  };
}

function startGame(room, code) {
  if (room.players.length !== 4 || room.started) return;

  room.started = true;
  room.serverTeam = "blue";

  positionPlayers(room);
  resetBall(room);

  console.log("PARTIDA INICIADA:", code);

  io.to(code).emit("game-start", {
    message: "Partida iniciada!"
  });

  updateRoom(code);
  broadcastState(code);
}

function scorePoint(room, code, team) {
  const index = team === "blue" ? 0 : 1;
  room.score[index]++;

  console.log("PUNTO:", team, "MARCADOR:", room.score);

  room.serverTeam = team;
  positionPlayers(room);
  resetBall(room);

  io.to(code).emit("point-scored", {
    team,
    score: room.score
  });

  broadcastState(code);
}

function joinPlayer(socket, code) {
  const room = rooms.get(code);
  if (!room) return;

  const slot = room.players.length;

  room.players.push({
    id: socket.id,
    slot,
    team: slot < 2 ? "blue" : "red",
    x: slot < 2 ? 300 : 700,
    y: slot % 2 === 0 ? 180 : 420,
    input: { x: 0, y: 0 }
  });

  socket.join(code);
  socket.data.roomCode = code;

  console.log("JUGADOR ENTRA:", socket.id, code);

  updateRoom(code);
}

function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;

  const room = rooms.get(code);

  console.log("JUGADOR SALE:", socket.id, code);

  if (room) {
    room.players = room.players.filter(p => p.id !== socket.id);

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

io.on("connection", socket => {
  console.log("NUEVA CONEXION:", socket.id);

  socket.on("create-room", callback => {
    if (socket.data.roomCode) {
      return callback?.({
        ok: false,
        message: "Ya estás en una sala."
      });
    }

    const code = createCode();

    const room = {
      players: [],
      started: false,
      ball: {
        x: 300,
        y: 300,
        vx: 0,
        vy: 0,
        moving: false
      },
      score: [0, 0],
      serverTeam: "blue"
    };

    rooms.set(code, room);
    joinPlayer(socket, code);

    console.log("SALA CREADA:", code);

    callback?.({
      ok: true,
      code,
      players: publicPlayers(room)
    });
  });

  socket.on("join-room", (data = {}, callback) => {
    const code = String(data.code || "").trim();

    console.log("SOLICITUD ENTRAR:", code);

    if (!/^\d{5}$/.test(code)) {
      return callback?.({
        ok: false,
        message: "El código debe tener 5 dígitos."
      });
    }

    if (socket.data.roomCode) {
      return callback?.({
        ok: false,
        message: "Ya estás en otra sala."
      });
    }

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

  socket.on("player-input", ({ x, y } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.started) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.input = {
      x: Math.max(-1, Math.min(1, Number(x) || 0)),
      y: Math.max(-1, Math.min(1, Number(y) || 0))
    };
  });

  socket.on("player-hit", (callback) => {
    const room = rooms.get(socket.data.roomCode);

    if (!room || !room.started) {
      return callback?.({ ok: false, message: "Partida no iniciada." });
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      return callback?.({ ok: false, message: "Jugador no encontrado." });
    }

    const ball = room.ball;
    const distance = Math.hypot(ball.x - player.x, ball.y - player.y);
    const limit = ball.moving ? 90 : 150;

    if (!ball.moving && player.team !== room.serverTeam) {
      return callback?.({ ok: false, message: "Es el turno de saque de la otra pareja." });
    }

    if (distance > limit) {
      return callback?.({ ok: false, message: "Acércate a la pelota para golpearla." });
    }

    const direction = player.team === "blue" ? 1 : -1;

    ball.vx = direction * 9;
    ball.vy = Math.max(
      -6,
      Math.min(6, (ball.y - player.y) * 0.09 + player.input.y * 2)
    );
    ball.moving = true;

    console.log("GOLPE:", player.team, "SALA:", socket.data.roomCode);

    callback?.({ ok: true });
    broadcastState(socket.data.roomCode);
  });

  socket.on("leave-room", () => leaveRoom(socket));

  socket.on("disconnect", reason => {
    console.log("DESCONECTADO:", socket.id, reason);
    leaveRoom(socket);
  });
});

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

    const ball = room.ball;

    if (ball.moving) {
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Rebote en las paredes laterales
      if (ball.y <= 45) {
        ball.y = 45;
        ball.vy = Math.abs(ball.vy);
      }

      if (ball.y >= 555) {
        ball.y = 555;
        ball.vy = -Math.abs(ball.vy);
      }

      // La pelota sale por el fondo de la pista
      if (ball.x >= 975) {
        scorePoint(room, code, "blue");
      } else if (ball.x <= 25) {
        scorePoint(room, code, "red");
      }
    }

    broadcastState(code);
  }
}, 50);

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("SERVIDOR ACTIVO EN PUERTO:", PORT);
});
