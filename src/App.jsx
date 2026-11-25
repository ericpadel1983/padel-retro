
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL = "https://padel-retro-1.onrender.com";

export default function App() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const joystickRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [ball, setBall] = useState({
    x: 500,
    y: 300,
    moving: false,
  });
  const [score, setScore] = useState({ blue: 0, red: 0 });
  const [started, setStarted] = useState(false);
  const [notice, setNotice] = useState("Conectando al servidor...");
  const [hitting, setHitting] = useState(false);

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setNotice("Conectado. ¡A jugar!");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setNotice("Conexión perdida. Reconectando...");
    });

    socket.on("connect_error", () => {
      setConnected(false);
      setNotice("No se puede conectar con el servidor.");
    });

    socket.on("room-updated", (data) => {
      if (!data) return;

      const code = data.code || data.roomCode;
      if (code) setRoomCode(String(code));

      if (Array.isArray(data.players)) {
        setPlayers(data.players);
      }

      if (data.ball) setBall(data.ball);
      if (data.score) setScore(data.score);

      if (data.started !== undefined) {
        setStarted(data.started);
      }
    });

    socket.on("game-start", (data) => {
      setStarted(true);
      setNotice("¡Partida iniciada!");
      if (data?.players) setPlayers(data.players);
      if (data?.ball) setBall(data.ball);
    });

    socket.on("game-state", (data) => {
      if (!data) return;

      if (Array.isArray(data.players)) {
        setPlayers(data.players);
      }

      if (data.ball) setBall(data.ball);
      if (data.score) setScore(data.score);
    });

    socket.on("point-scored", (data) => {
      if (data?.score) setScore(data.score);
      setNotice("¡Punto!");
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Fondo y pista
    ctx.fillStyle = "#176b3a";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#328b50";
    ctx.fillRect(25, 25, 950, 550);

    // Líneas de la pista
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.strokeRect(25, 25, 950, 550);

    ctx.beginPath();
    ctx.moveTo(500, 25);
    ctx.lineTo(500, 575);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(25, 170);
    ctx.lineTo(975, 170);
    ctx.moveTo(25, 430);
    ctx.lineTo(975, 430);
    ctx.stroke();

    // Red
    ctx.strokeStyle = "#dddddd";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(500, 25);
    ctx.lineTo(500, 575);
    ctx.stroke();

    // Jugadores
    players.forEach((player, index) => {
      const x = Number(player.x ?? 250);
      const y = Number(player.y ?? 150 + index * 100);

      ctx.beginPath();
      ctx.arc(x, y, 17, 0, Math.PI * 2);
      ctx.fillStyle =
        player.team === "red" ? "#ed3434" : "#258cff";
      ctx.fill();

      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        player.name || `J${index + 1}`,
        x,
        y - 25
      );
    });

    // Pelota
    if (ball) {
      const bx = Number(ball.x ?? 500);
      const by = Number(ball.y ?? 300);

      if (ball.moving) {
        ctx.beginPath();
        ctx.arc(bx, by, 13, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#f4ed35";
      ctx.fill();

      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [players, ball]);

  function createRoom() {
    if (!socketRef.current?.connected) {
      setNotice("Espera a que se conecte el servidor.");
      return;
    }

    socketRef.current.emit("create-room");
    setNotice("Creando sala...");
  }

  function joinRoom() {
    if (!socketRef.current?.connected) {
      setNotice("Espera a que se conecte el servidor.");
      return;
    }

    const code = inputCode.trim();

    if (!/^\d{5}$/.test(code)) {
      setNotice("Introduce un código de 5 números.");
      return;
    }

    socketRef.current.emit("join-room", { code });
    setNotice("Entrando en la sala...");
  }

  function hitBall() {
    if (!socketRef.current?.connected || !roomCode) return;

    if (hitting) return;

    setHitting(true);

    socketRef.current.emit("player-hit", (response) => {
      setHitting(false);

      if (response?.ok) {
        setNotice("¡Buen golpe!");
      } else {
        setNotice(
          response?.message || "Acércate a la pelota para golpearla."
        );
      }
    });

    // Evita que el botón quede bloqueado si el servidor no responde.
    setTimeout(() => setHitting(false), 1500);
  }

  function moveJoystick(event) {
    if (!joystickRef.current || !socketRef.current || !roomCode) {
      return;
    }

    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let x = (event.clientX - centerX) / (rect.width / 2);
    let y = (event.clientY - centerY) / (rect.height / 2);

    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));

    socketRef.current.emit("player-input", { x, y });
  }

  function stopJoystick() {
    if (socketRef.current && roomCode) {
      socketRef.current.emit("player-input", { x: 0, y: 0 });
    }
  }

  function leaveRoom() {
    if (socketRef.current) {
      socketRef.current.emit("leave-room");
    }

    setRoomCode("");
    setPlayers([]);
    setStarted(false);
    setScore({ blue: 0, red: 0 });
    setNotice("Has salido de la sala.");
  }

  const buttonStyle = {
    padding: "12px 18px",
    margin: "5px",
    border: "none",
    borderRadius: "9px",
    fontWeight: "bold",
    fontSize: "15px",
    cursor: "pointer",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#10251a",
        color: "white",
        fontFamily: "Arial, sans-serif",
        padding: "16px",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ color: "#f4ed35", margin: "8px 0" }}>
        🎾 PÁDEL RETRO
      </h1>

      <p style={{ margin: "8px" }}>
        {connected ? "🟢 Conectado" : "🔴 Desconectado"}
      </p>

      <div
        style={{
          background: "#263c30",
          padding: "14px",
          borderRadius: "12px",
          maxWidth: "600px",
          margin: "0 auto 16px",
        }}
      >
        <p>{notice}</p>

        {!roomCode ? (
          <>
            <button
              onClick={createRoom}
              disabled={!connected}
              style={{
                ...buttonStyle,
                background: "#f4ed35",
                color: "#17251b",
              }}
            >
              CREAR PARTIDA
            </button>

            <div style={{ marginTop: "15px" }}>
              <input
                value={inputCode}
                onChange={(event) =>
                  setInputCode(event.target.value.replace(/\D/g, "").slice(0, 5))
                }
                placeholder="Código de sala"
                inputMode="numeric"
                maxLength={5}
                style={{
                  padding: "12px",
                  width: "145px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "16px",
                  textAlign: "center",
                }}
              />

              <button
                onClick={joinRoom}
                disabled={!connected}
                style={{
                  ...buttonStyle,
                  background: "#258cff",
                  color: "white",
                }}
              >
                ENTRAR
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>
              Sala: <span style={{ color: "#f4ed35" }}>{roomCode}</span>
            </h2>
            <p>Jugadores: {players.length} / 4</p>
            <p>
              {started
                ? "🏆 ¡PARTIDA EN JUEGO!"
                : "Esperando a los 4 jugadores..."}
            </p>

            <button
              onClick={leaveRoom}
              style={{
                ...buttonStyle,
                background: "#b83232",
                color: "white",
              }}
            >
              SALIR DE LA SALA
            </button>
          </>
        )}
      </div>

      {roomCode && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "35px",
              fontSize: "24px",
              fontWeight: "bold",
              margin: "12px",
            }}
          >
            <span style={{ color: "#258cff" }}>
              AZUL {score.blue ?? 0}
            </span>
            <span style={{ color: "#ff4949" }}>
              ROJO {score.red ?? 0}
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={1000}
            height={600}
            style={{
              width: "100%",
              maxWidth: "650px",
              height: "auto",
              border: "3px solid white",
              borderRadius: "8px",
              display: "block",
              margin: "0 auto",
              background: "#176b3a",
            }}
          />

          {started && (
            <div
              style={{
                maxWidth: "600px",
                margin: "18px auto",
                display: "flex",
                justifyContent: "space-around",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <div>
                <p style={{ fontWeight: "bold" }}>JOYSTICK</p>
                <div
                  ref={joystickRef}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    moveJoystick(event);
                  }}
                  onPointerMove={(event) => {
                    if (event.buttons === 1) moveJoystick(event);
                  }}
                  onPointerUp={stopJoystick}
                  onPointerCancel={stopJoystick}
                  style={{
                    width: "125px",
                    height: "125px",
                    borderRadius: "50%",
                    background: "#344d3c",
                    border: "4px solid #a7c5a9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    touchAction: "none",
                    userSelect: "none",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "#f4ed35",
                      border: "3px solid white",
                    }}
                  />
                </div>
              </div>

              <button
                onClick={hitBall}
                disabled={hitting}
                style={{
                  width: "115px",
                  height: "115px",
                  borderRadius: "50%",
                  background: hitting ? "#888" : "#e83c32",
                  color: "white",
                  border: "4px solid white",
                  fontSize: "18px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  touchAction: "manipulation",
                }}
              >
                {hitting ? "..." : "GOLPEAR"}
              </button>
            </div>
          )}
        </>
      )}

      <p style={{ fontSize: "12px", opacity: 0.7, marginTop: "25px" }}>
        PÁDEL RETRO ONLINE · Versión de prueba
      </p>
    </main>
  );
}
