
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = 'https://padel-retro-1.onrender.com';

export default function App() {
  const canvasRef = useRef(null);
  const controls = useRef({});
  const [roomCode, setRoomCode] = useState('');
  const [notice, setNotice] = useState('');
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    const connection = io(SERVER_URL);
    setSocket(connection);

    connection.on('connect', () => {
      setConnected(true);
      setNotice('Conectado al servidor online.');
    });

    connection.on('disconnect', () => {
      setConnected(false);
      setPlayerCount(0);
      setNotice('Reconectando...');
    });

    connection.on('connect_error', () => {
      setNotice('No se pudo conectar al servidor.');
    });

    connection.on('room-updated', room => {
      setPlayerCount(room.count);
      setRoomCode(room.code);
    });

    return () => connection.disconnect();
  }, []);

  function createRoom() {
    if (!socket?.connected) {
      setNotice('Esperando conexión con el servidor.');
      return;
    }

    socket.emit('create-room', result => {
      if (!result.ok) {
        setNotice(result.message || 'Error al crear sala.');
        return;
      }

      setRoomCode(result.code);
      setPlayerCount(result.count);
      setNotice(`Sala ${result.code} creada. ¡Invita a tus amigos!`);
    });
  }

  function joinRoom(event) {
    event.preventDefault();

    if (!socket?.connected) {
      setNotice('No hay conexión con el servidor.');
      return;
    }

    const code = roomCode.trim().toUpperCase();

    socket.emit('join-room', { code }, result => {
      if (!result.ok) {
        setNotice(result.message || 'No se pudo entrar.');
        return;
      }

      setRoomCode(result.code);
      setPlayerCount(result.count);
      setNotice(`¡Dentro de la sala ${result.code}!`);
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const W = 800;
    const H = 450;

    let left = { x: 35, y: 180 };
    let right = { x: 753, y: 180 };
    let ball = { x: 400, y: 225, vx: 5, vy: 3 };

    let score = [0, 0];
    let animation;
    let lastTime = 0;

    const paddleHeight = 85;
    const paddleWidth = 12;

    function resetBall() {
      ball = {
        x: W / 2,
        y: H / 2,
        vx: ball.vx > 0 ? -5 : 5,
        vy: Math.random() > 0.5 ? 3 : -3
      };
    }

    function update(delta) {
      const speed = 0.35 * delta;

      if (controls.current.leftUp) left.y -= speed;
      if (controls.current.leftDown) left.y += speed;
      if (controls.current.rightUp) right.y -= speed;
      if (controls.current.rightDown) right.y += speed;

      left.y = Math.max(10, Math.min(H - paddleHeight - 10, left.y));
      right.y = Math.max(10, Math.min(H - paddleHeight - 10, right.y));

      ball.x += ball.vx * delta / 16.67;
      ball.y += ball.vy * delta / 16.67;

      if (ball.y < 15 || ball.y > H - 15) {
        ball.vy *= -1;
      }

      if (
        ball.vx < 0 &&
        ball.x - 10 < left.x + paddleWidth &&
        ball.x > left.x &&
        ball.y > left.y - 8 &&
        ball.y < left.y + paddleHeight + 8
      ) {
        ball.vx = Math.abs(ball.vx) + 0.3;
      }

      if (
        ball.vx > 0 &&
        ball.x + 10 > right.x &&
        ball.x < right.x + paddleWidth &&
        ball.y > right.y - 8 &&
        ball.y < right.y + paddleHeight + 8
      ) {
        ball.vx = -Math.abs(ball.vx) - 0.3;
      }

      if (ball.x < 0) {
        score[1]++;
        resetBall();
      }

      if (ball.x > W) {
        score[0]++;
        resetBall();
      }
    }

    function draw() {
      ctx.fillStyle = '#176b42';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, W - 20, H - 20);

      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 10);
      ctx.lineTo(W / 2, H - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(left.x, left.y, paddleWidth, paddleHeight);
      ctx.fillRect(right.x, right.y, paddleWidth, paddleHeight);

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#eaff54';
      ctx.fill();

      ctx.font = 'bold 38px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${score[0]} - ${score[1]}`, W / 2, 55);
    }

    function loop(time) {
      const delta = lastTime ? Math.min(time - lastTime, 40) : 16.67;
      lastTime = time;

      update(delta);
      draw();

      animation = requestAnimationFrame(loop);
    }

    function keyDown(e) {
      const key = e.key.toLowerCase();

      if (['arrowup', 'arrowdown', 'w', 's'].includes(key)) {
        e.preventDefault();
      }

      if (key === 'w') controls.current.leftUp = true;
      if (key === 's') controls.current.leftDown = true;
      if (key === 'arrowup') controls.current.rightUp = true;
      if (key === 'arrowdown') controls.current.rightDown = true;
    }

    function keyUp(e) {
      const key = e.key.toLowerCase();

      if (key === 'w') controls.current.leftUp = false;
      if (key === 's') controls.current.leftDown = false;
      if (key === 'arrowup') controls.current.rightUp = false;
      if (key === 'arrowdown') controls.current.rightDown = false;
    }

    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    animation = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, []);

  function hold(control, active) {
    controls.current[control] = active;
  }

  const buttonStyle = {
    padding: '15px 22px',
    margin: '5px',
    fontSize: '20px',
    fontWeight: 'bold',
    background: '#eaff54',
    color: '#101a2d',
    border: '0',
    borderRadius: '8px',
    touchAction: 'none'
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#inicio">
          <span className="brand-mark">PR</span>
          <span>PÁDEL<span className="brand-accent">RETRO</span></span>
        </a>
        <span className="status">
          <i /> {connected ? 'ONLINE' : 'CONECTANDO'}
        </span>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow">INSERT COIN · SELECT TEAM</p>
          <h1>¡A la pista,<br /><span>campeón!</span></h1>
          <p className="intro">
            Pádel clásico, energía arcade. ¡Empieza a jugar!
          </p>

          <button className="primary-button" onClick={createRoom}>
            CREAR PARTIDA ↗
          </button>

          <form className="join-form" onSubmit={joinRoom}>
            <input
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder="CÓDIGO DE SALA"
              maxLength={5}
            />
            <button type="submit" className="join-button">
              UNIRSE
            </button>
          </form>

          {notice && <p className="notice">{notice}</p>}

          <p>{playerCount}/4 JUGADORES CONECTADOS</p>
        </div>
      </section>

      <section style={{ padding: 12, textAlign: 'center' }}>
        <h2>¡PÁDEL RETRO ARCADE!</h2>

        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          style={{
            width: '100%',
            maxWidth: '800px',
            height: 'auto',
            border: '4px solid #eaff54',
            borderRadius: '8px',
            display: 'block',
            margin: 'auto'
          }}
        />

        <p>Jugador 1: W / S · Jugador 2: ↑ / ↓</p>

        <div>
          <button
            style={buttonStyle}
            onPointerDown={() => hold('leftUp', true)}
            onPointerUp={() => hold('leftUp', false)}
            onPointerLeave={() => hold('leftUp', false)}
            onPointerCancel={() => hold('leftUp', false)}
          >⬆ J1</button>

          <button
            style={buttonStyle}
            onPointerDown={() => hold('leftDown', true)}
            onPointerUp={() => hold('leftDown', false)}
            onPointerLeave={() => hold('leftDown', false)}
            onPointerCancel={() => hold('leftDown', false)}
          >⬇ J1</button>

          <button
            style={buttonStyle}
            onPointerDown={() => hold('rightUp', true)}
            onPointerUp={() => hold('rightUp', false)}
            onPointerLeave={() => hold('rightUp', false)}
            onPointerCancel={() => hold('rightUp', false)}
          >⬆ J2</button>

          <button
            style={buttonStyle}
            onPointerDown={() => hold('rightDown', true)}
            onPointerUp={() => hold('rightDown', false)}
            onPointerLeave={() => hold('rightDown', false)}
            onPointerCancel={() => hold('rightDown', false)}
          >⬇ J2</button>
        </div>
      </section>

      <footer>
        <span>© 1986–2026 PÁDEL RETRO</span>
        <span>HECHO PARA GRANDES PARTIDOS ♥</span>
      </footer>
    </main>
  );
}
