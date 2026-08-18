import { Crown } from 'lucide-react';

export function WaitingRoom({ roomCode, players, isHost, onStartGame, busy = false }) {
  const playerList = Object.values(players || {});

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 min-h-screen bg-stone-900 text-stone-100">
      <h2 className="text-2xl font-bold text-amber-500">
        Sala: <span className="font-mono">{roomCode}</span>
      </h2>

      <div className="w-full max-w-xs bg-stone-800 rounded p-4 border border-stone-700">
        <h3 className="text-sm font-semibold text-stone-400 mb-3">
          Jugadores conectados ({playerList.length}):
        </h3>
        <ul className="space-y-2">
          {playerList.map((p) => (
            <li key={p.id} className="bg-stone-700 p-2.5 rounded text-stone-200 text-sm flex justify-between items-center">
              <span>{p.name}</span>
              <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-stone-500'}`} />{p.isHost && <Crown className="w-4 h-4 text-amber-400 inline" />}</span>
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <button 
          onClick={onStartGame}
          disabled={busy || playerList.length < 4 || playerList.some((player) => !player.connected)}
          className="w-full max-w-xs bg-red-700 hover:bg-red-800 disabled:opacity-40 font-bold py-3 rounded transition text-stone-100"
        >
          {playerList.length < 4 ? `Faltan ${4 - playerList.length} jugadores` : 'Iniciar Partida'}
        </button>
      ) : (
        <p className="text-xs text-stone-400 animate-pulse">Esperando a que el anfitrión inicie...</p>
      )}
    </div>
  );
}
