import { Copy, Crown, Flame, Users } from 'lucide-react';

export function WaitingRoom({ roomCode, players, isHost, onStartGame, busy = false }) {
  const playerList = Object.values(players || {});

  return (
    <div className="salem-shell flex min-h-screen flex-col items-center justify-center p-5 text-stone-100">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center"><Flame className="mx-auto h-8 w-8 text-red-600" /><p className="eyebrow mt-3">El pueblo se reúne</p><h1 className="display-type mt-1 text-3xl font-bold text-[#ead8b2]">Sala de espera</h1></header>
        <section className="period-panel rounded-2xl p-5 sm:p-6">
          <div className="relative z-10">
            <p className="text-center text-[10px] font-bold uppercase tracking-[.2em] text-stone-500">Código de invitación</p>
            <button type="button" onClick={() => navigator.clipboard?.writeText(roomCode)} title="Copiar código" className="group mx-auto mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-3xl font-black tracking-[.22em] text-amber-400 transition hover:bg-amber-950/30"><span>{roomCode}</span><Copy className="h-4 w-4 opacity-40 transition group-hover:opacity-100" /></button>
            <div className="ornament mx-auto my-5"><span>◆</span></div>
            <h2 className="mb-3 flex items-center justify-between text-xs font-semibold text-stone-400"><span className="flex items-center gap-2"><Users className="h-4 w-4" />Jugadores convocados</span><span>{playerList.length}/12</span></h2>
            <ul className="space-y-2">
              {playerList.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-stone-700/70 bg-black/25 p-3 text-sm text-stone-200">
                  <span>{p.name}</span>
                  <span className="flex items-center gap-2"><span className={`status-dot h-2 w-2 rounded-full ${p.connected ? 'bg-emerald-400 text-emerald-400' : 'bg-stone-500 text-stone-500'}`} />{p.isHost && <Crown className="inline h-4 w-4 text-amber-400" />}</span>
                </li>
              ))}
            </ul>
            {isHost ? (
              <button onClick={onStartGame} disabled={busy || playerList.length < 4 || playerList.some((player) => !player.connected)} className="wax-button mt-5 w-full rounded-lg py-3.5 font-bold">
                {playerList.length < 4 ? `Faltan ${4 - playerList.length} jugadores` : 'Iniciar Partida'}
              </button>
            ) : (
              <p className="mt-5 text-center text-xs text-stone-400 animate-pulse">Esperando a que el anfitrión inicie...</p>
            )}
          </div>
        </section>
        <p className="mt-4 text-center text-[10px] leading-4 text-stone-600">La partida comienza con un mínimo de cuatro jugadores conectados.</p>
      </div>
    </div>
  );
}
