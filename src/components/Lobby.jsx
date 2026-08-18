import { useState } from 'react';

export function Lobby({ onCreateRoom, onJoinRoom, busy = false, error = '' }) {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState('CREATE');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || (mode === 'JOIN' && roomCode.trim().length !== 6)) {
      alert(mode === 'CREATE' ? 'Por favor ingresa tu nombre.' : 'Ingresa tu nombre y el codigo de 6 caracteres.');
      return;
    }
    if (mode === 'CREATE') onCreateRoom(username.trim());
    else onJoinRoom(roomCode.trim().toUpperCase(), username.trim());
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6 space-y-4 min-h-screen bg-stone-950 text-stone-100">
      <h1 className="text-4xl font-serif text-amber-500 font-bold tracking-widest text-center">
        SALEM 1692
      </h1>
      <p className="text-sm text-stone-400">Juicios de Brujería</p>
      <p className="max-w-xs text-center text-xs text-stone-500">Crea una sala con codigo generado por el servidor o entra con una invitacion.</p>
      {error && <p role="alert" className="max-w-xs rounded border border-red-800 bg-red-950/50 p-2 text-center text-xs text-red-200">{error}</p>}
      
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3 pt-6">
        <div className="grid grid-cols-2 rounded-lg bg-stone-800 p-1 text-xs font-bold">
          <button type="button" onClick={() => setMode('CREATE')} className={`rounded-md py-2 ${mode === 'CREATE' ? 'bg-amber-700 text-white' : 'text-stone-400'}`}>Crear sala</button>
          <button type="button" onClick={() => setMode('JOIN')} className={`rounded-md py-2 ${mode === 'JOIN' ? 'bg-amber-700 text-white' : 'text-stone-400'}`}>Unirme</button>
        </div>
        <input 
          type="text" 
          placeholder="Tu Nombre" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-3 rounded bg-stone-800 border border-stone-700 text-center focus:outline-none focus:border-amber-500 text-stone-100"
        />
        {mode === 'JOIN' && <input type="text" minLength="6" maxLength="6" placeholder="Codigo de 6 caracteres" value={roomCode} onChange={(e) => setRoomCode(e.target.value.replace(/[^a-z0-9]/gi, ''))} className="w-full p-3 rounded bg-stone-800 border border-stone-700 text-center uppercase tracking-[.25em] focus:outline-none focus:border-amber-500 text-stone-100" />}
        <button 
          type="submit" 
          disabled={busy}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 font-bold py-3 rounded transition text-stone-100"
        >
          {busy ? 'Conectando...' : mode === 'CREATE' ? 'Crear sala privada' : 'Entrar a la sala'}
        </button>
      </form>
    </div>
  );
}
