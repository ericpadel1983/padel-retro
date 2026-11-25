
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL = "https://padel-retro-1.onrender.com";

export default function App() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [ball, setBall] = useState({ x: 500, y: 300 });
  const [score, setScore] = useState([0, 0]);
  const [started, setStarted] = useState(false);
  const [notice, setNotice] = useState("Connectant amb el servidor...");

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setNotice("Connectat! Crea una sala o entra en una.");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setStarted(false);
      setNotice("Connexió perduda. Reconnectant...");
    });

    socket.on("connect_error", () => {
      setNotice("No es pot connectar. Torna-ho a provar.");
    });

    socket.on("room-updated", (data) => {
      setRoomCode(data.code);
      setPlayers(data.players || []);
      setStarted(data.started);
      if (data.message) setNotice(data.message);
      else setNotice(`Jugadors: ${data.count}/4`);
    });

    socket.on("game-start", (data) => {
      setStarted(true);
      setNotice(data.message || "Partida iniciada!");
    });

    socket.on("game-state", (data) => {
      setPlayers(data.players || []);
      setBall(data.ball || { x: 500, y: 300 });
      setScore(data.score || [0, 0]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 1000, 600);

    // Fons i pista
    ctx.fillStyle = "#176b43";
    ctx.fillRect(0, 0, 1000, 600);

    ctx.fillStyle = "#247e50";
    ctx.fillRect(25, 25, 950, 550);

    // Línies exteriors
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.strokeRect(25, 25, 950, 550);

    // Xarxa central
    ctx.beginPath();
    ctx.moveTo(500, 25);
    ctx.lineTo(500, 575);
    ctx.strokeStyle = "#eeeeee";
    ctx.lineWidth = 8;
    ctx.stroke();

    // Línies de servei
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(250, 25);
    ctx.lineTo(250, 575);
    ctx.moveTo(750, 25);
    ctx.lineTo(750, 575);
    ctx.moveTo(250, 300);
    ctx.lineTo(750, 300);
    ctx.stroke();

    // Jugadors
    players.forEach((player) => {
      ctx.beginPath();
      ctx.arc(player.x, player.y, 19, 0, Math.PI * 2);
      ctx.fillStyle = player.team === "blue" ? "#36a8ff" : "#ff5555";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`J${player.slot + 1}`, player.x, player.y - 27);
    });

    // Pilota
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#eaff40";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }, [players, ball]);

  function createRoom() {
    socketRef.current?.emit("create-room", (result) => {
      if (!result?.ok) {
        setNotice(result?.message || "No s'ha pogut crear la sala.");
        return;
      }
      setRoomCode(result.code);
      setPlayers(result.players || []);
      setNotice("Sala creada. Esperant jugadors...");
    });
  }

  function joinRoom() {
    const code = inputCode.trim().toUpperCase();

    if (code.length !== 5) {
      setNotice("Escriu un codi de 5 caràcters.");
      return;
    }

    socketRef.current?.emit("join-room", { code }, (result) => {
      if (!result?.ok) {
        setNotice(result?.message || "No s'ha pogut entrar a la sala.");
        return;
      }
      setRoomCode(result.code);
      setPlayers(result.players || []);
      setNotice(`Has entrat a la sala ${result.code}.`);
    });
  }

  function sendJoystick(x, y) {
    if (!started) return;
    socketRef.current?.emit("player-input", { x, y });
  }

  function handleJoystick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let x = (event.clientX - centerX) / (rect.width * 0.35);
    let y = (event.clientY - centerY) / (rect.height * 0.35);

    const length = Math.sqrt(x * x + y * y);
    if (length > 1) {
      x /= length;
      y /= length;
    }

    sendJoystick(x, y);
  }

  function stopJoystick() {
    sendJoystick(0, 0);
  }

  function leaveRoom() {
    socketRef.current?.emit("leave-room");
    setRoomCode("");
    setPlayers([]);
    setStarted(false);
    setNotice("Has sortit de la sala.");
  }

  const buttonStyle = {
    padding: "12px 18px",
    border: "0",
    borderRadius: "10px",
    background: "#e8bd43",
    color: "#17251c",
    fontWeight: "bold",
    fontSize: "15px",
    cursor: "pointer"
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#14251c",
      color: "white",
      padding: "18px",
      fontFamily: "Arial, sans-serif",
      textAlign: "center",
      boxSizing: "border-box"
    }}>
      <h1 style={{ color: "#e8bd43", marginBottom: "5px" }}>
        🎾 PÁDEL RETRO
      </h1>
      <p style={{ marginTop: 0 }}>ONLINE · 2 CONTRA 2</p>

      <p style={{ color: connected ? "#75e69a" : "#ff8585" }}>
        ● {connected ? "Servidor connectat" : "Connectant..."}
      </p>

      <div style={{
        background: "#263c30",
        padding: "14px",
        borderRadius: "12px",
        maxWidth: "600px",
        margin: "0 auto 16px"
      }}>
        <p>{notice}</p>

        {!roomCode ? (
          <>
            <button
              style={buttonStyle}
              onClick={createRoom}
              disabled={!connected}
            >
              CREAR SALA
            </button>

            <div style={{
              display: "flex",
              gap: "8px",
              justifyContent: "center",
              marginTop: "14px",
              flexWrap: "wrap"
            }}>
              <input
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="CODI DE SALA"
                maxLength={5}
                style={{
                  padding: "12px",
                  width: "145px",
                  borderRadius: "8px",
                  border: "0",
                  textAlign: "center",
                  fontSize: "16px"
                }}
              />
              <button
                style={buttonStyle}
                onClick={joinRoom}
                disabled={!connected}
              >
                ENTRAR
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ color: "#e8bd43", letterSpacing: "4px" }}>
              {roomCode}
            </h2>
            <p>Comparteix aquest codi amb els altres jugadors.</p>
            <p>Jugadors: {players.length}/4</p>
            <p>{started ? "PARTIDA EN JOC" : "ESPERANT JUGADORS..."}</p>
            <button style={buttonStyle} onClick={leaveRoom}>
              SORTIR DE LA SALA
            </button>
          </>
        )}
      </div>

      <div style={{
        maxWidth: "800px",
        margin: "auto",
        background: "#247e50",
        borderRadius: "12px",
        overflow: "hidden"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-around",
          padding: "12px",
          fontSize: "22px",
          fontWeight: "bold"
        }}>
          <span style={{ color: "#65baff" }}>BLAUS {score[0]}</span>
          <span style={{ color: "#ff8585" }}>VERMELLS {score[1]}</span>
        </div>

        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            touchAction: "none"
          }}
        />
      </div>

      <div style={{
        margin: "22px auto",
        maxWidth: "350px"
      }}>
        <p style={{ color: "#e8bd43", fontWeight: "bold" }}>
          JOYSTICK DE MOVIMENT
        </p>

        <div
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleJoystick(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) handleJoystick(e);
          }}
          onPointerUp={stopJoystick}
          onPointerCancel={stopJoystick}
          style={{
            width: "150px",
            height: "150px",
            borderRadius: "50%",
            background: "#344c3e",
            border: "4px solid #e8bd43",
            margin: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "none",
            userSelect: "none"
          }}
        >
          <div style={{
            width: "55px",
            height: "55px",
            borderRadius: "50%",
            background: "#e8bd43",
            boxShadow: "0 3px 8px #111"
          }} />
        </div>

        <p style={{ fontSize: "13px", color: "#c5d4ca" }}>
          Arrossega el dit pel joystick per moure el teu jugador.
        </p>
      </div>

      <p style={{ fontSize: "12px", color: "#9aafa1" }}>
        Pádel Retro Online · Primera versió multijugador
      </p>
    </main>
  );
}
