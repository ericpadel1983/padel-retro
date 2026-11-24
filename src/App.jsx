
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = 'https://padel-retro-1.onrender.com';

export default function App() {
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
      setNotice('Conexión perdida. Intentando reconectar...');
    });

    connection.on('connect_error', () => {
      setNotice('No se ha podido conectar. Inténtalo de nuevo.');
    });

    connection.on('room-updated', (room) => {
      setPlayerCount(room.count);
      setRoomCode(room.code);
    });

    return () => {
      connection.disconnect();
    };
  }, []);

  function createRoom() {
    if (!socket?.connected) {
      setNotice('Conectando con el servidor. Espera un momento.');
      return;
    }

    socket.emit('create-room', (result) => {
      if (!result.ok) {
        setNotice(result.message || 'No se pudo crear la sala.');
        return;
      }

      setRoomCode(result.code);
      setPlayerCount(result.count);
      setNotice(`¡Sala ${result.code} creada! Comparte el código con tus amigos.`);
    });
  }

  function joinRoom(event) {
    event.preventDefault();

    const code = roomCode.trim().toUpperCase();

    if (!code) {
      setNotice('Escribe un código de sala para continuar.');
      return;
    }

    if (!socket?.connected) {
      setNotice('No hay conexión con el servidor.');
      return;
    }

    socket.emit('join-room', { code }, (result) => {
      if (!result.ok) {
        setNotice(result.message);
        return;
      }

      setRoomCode(result.code);
      setPlayerCount(result.count);
      setNotice(`¡Te has unido a la sala ${result.code}! Jugadores: ${result.count}/4.`);
    });
  }

  return (
    <main className="page-shell">
      <div className="scanlines" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Pádel Retro inicio">
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
          <p className="intro">Pádel clásico, energía arcade. Reúne a tus amigos y prepárate para el partido.</p>

          <div className="room-actions">
            <button className="primary-button" onClick={createRoom}>
              CREAR PARTIDA <span>↗</span>
            </button>

            <form className="join-form" onSubmit={joinRoom}>
              <label className="sr-only" htmlFor="room-code">Código de sala</label>
              <input
                id="room-code"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                placeholder="CÓDIGO DE SALA"
                maxLength={5}
              />
              <button type="submit" className="join-button">UNIRSE</button>
            </form>
          </div>

          {notice && <p className="notice" role="status">{notice}</p>}

          <div className="players">
            <span className="player-dots"><i /><i /><i /><i /></span>
            <span>{playerCount}/4 JUGADORES CONECTADOS · 2 VS 2</span>
          </div>
        </div>

        <div className="court-wrap" aria-label="Ilustración de una pista de pádel retro">
          <div className="sun" />
          <div className="court">
            <div className="court-back" />
            <div className="court-center" />
            <div className="court-net" />
            <div className="court-line court-line-left" />
            <div className="court-line court-line-right" />
            <div className="player player-one"><span /></div>
            <div className="player player-two"><span /></div>
            <div className="player player-three"><span /></div>
            <div className="player player-four"><span /></div>
            <div className="ball" />
          </div>
          <div className="court-label">MATCH 01 <span>•</span> 00:00</div>
          <div className="pixel-star star-one">✦</div>
          <div className="pixel-star star-two">✧</div>
        </div>
      </section>

      <section className="features" aria-label="Características">
        <article><span className="feature-icon">01</span><div><h2>FORMA TU EQUIPO</h2><p>Invita a tres amigos a la pista.</p></div></article>
        <article><span className="feature-icon">02</span><div><h2>JUEGA EN LÍNEA</h2><p>Salas online para hasta cuatro jugadores.</p></div></article>
        <article><span className="feature-icon">03</span><div><h2>VUELVE AL ARCADE</h2><p>Una vibra retro y pura diversión.</p></div></article>
      </section>

      <footer>
        <span>© 1986–2026 PÁDEL RETRO</span>
        <span>HECHO PARA GRANDES PARTIDOS <b>♥</b></span>
      </footer>
    </main>
  );
}
