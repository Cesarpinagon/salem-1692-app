import { useState } from 'react';
import { ArrowRight, Flame, KeyRound, Plus, ScrollText } from 'lucide-react';

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
    <main className="lobby-scene text-stone-100">
      <div className="lobby-content mx-auto grid min-h-screen w-full max-w-7xl items-end gap-10 px-5 py-8 sm:px-8 md:items-center lg:grid-cols-[1fr_400px] lg:px-12 lg:py-12">
        <section className="max-w-2xl pb-2 text-center lg:pb-0 lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-700/40 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.22em] text-amber-200 backdrop-blur">
            <Flame className="h-3.5 w-3.5 text-red-500" /> Deducción social · 4 a 12 jugadores
          </div>
          <p className="eyebrow">Massachusetts · Año del Señor</p>
          <h1 className="display-type mt-2 text-5xl font-black leading-none text-[#ead8b2] drop-shadow-2xl sm:text-7xl lg:text-8xl">SALEM <span className="text-red-700">1692</span></h1>
          <div className="ornament mx-auto my-5 lg:mx-0"><span>◆</span></div>
          <p className="display-type text-xl italic text-stone-200 sm:text-2xl">La verdad arde. La sospecha también.</p>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-stone-400 lg:mx-0">Oculta tu identidad, descubre a las brujas y decide en quién confiar antes de que el pueblo se vuelva contra ti.</p>
        </section>

        <section className="period-panel w-full rounded-2xl p-5 sm:p-7">
          <div className="relative z-10">
            <div className="mb-5 flex items-start gap-3">
              <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-2.5 text-amber-400"><ScrollText className="h-5 w-5" /></div>
              <div><p className="eyebrow">Acta del pueblo</p><h2 className="display-type mt-1 text-xl font-bold">Entra en la historia</h2></div>
            </div>
            {error && <p role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-950/60 p-3 text-xs leading-5 text-red-200">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 rounded-lg border border-stone-700/70 bg-black/35 p-1 text-xs font-bold">
                <button type="button" onClick={() => setMode('CREATE')} className={`flex items-center justify-center gap-1.5 rounded-md py-2.5 transition ${mode === 'CREATE' ? 'bg-amber-800/80 text-amber-50 shadow' : 'text-stone-500 hover:text-stone-300'}`}><Plus className="h-3.5 w-3.5" />Crear sala</button>
                <button type="button" onClick={() => setMode('JOIN')} className={`flex items-center justify-center gap-1.5 rounded-md py-2.5 transition ${mode === 'JOIN' ? 'bg-amber-800/80 text-amber-50 shadow' : 'text-stone-500 hover:text-stone-300'}`}><KeyRound className="h-3.5 w-3.5" />Usar código</button>
              </div>
              <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.18em] text-stone-500">Tu nombre en el registro</span><input type="text" autoComplete="nickname" placeholder="Escribe tu nombre" value={username} onChange={(e) => setUsername(e.target.value)} className="period-field p-3 text-center" /></label>
              {mode === 'JOIN' && <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.18em] text-stone-500">Código de invitación</span><input type="text" minLength="6" maxLength="6" inputMode="text" placeholder="ABC123" value={roomCode} onChange={(e) => setRoomCode(e.target.value.replace(/[^a-z0-9]/gi, ''))} className="period-field p-3 text-center uppercase tracking-[.28em]" /></label>}
              <button type="submit" disabled={busy} className="wax-button flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-sm font-bold">{busy ? 'Abriendo el registro...' : mode === 'CREATE' ? 'Fundar una sala privada' : 'Entrar a la sala'}{!busy && <ArrowRight className="h-4 w-4" />}</button>
            </form>
            <p className="mt-4 text-center text-[10px] leading-4 text-stone-600">Cada jugador necesita su propio dispositivo y el código de seis caracteres.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
