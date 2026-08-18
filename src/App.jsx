import { useCallback, useEffect, useRef, useState } from 'react';
import { Lobby } from './components/Lobby';
import { WaitingRoom } from './components/WaitingRoom';
import { NightFirst } from './components/NightFirst';
import { GameBoard } from './components/GameBoard';
import { SpecialEvents } from './components/SpecialEvents';
import { clearSession, createGame, ensurePlayerIdentity, executeGameAction, joinGame, restoreSession, sessionAccessWasLost, subscribeToPlayerView } from './services/gameService';

function messageFrom(error) {
  return error?.message?.replace(/^Firebase:\s*/i, '') || 'No se pudo completar la accion.';
}

export default function App() {
  const [session, setSession] = useState(() => restoreSession());
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.gameId || !session?.playerId) return undefined;
    let unsubscribe = () => {};
    ensurePlayerIdentity()
      .then(() => {
        unsubscribe = subscribeToPlayerView(session.gameId, session.playerId, setView, (cause) => {
          if (sessionAccessWasLost(cause)) {
            clearSession();
            setView(null);
            setSession(null);
            setError('La sala anterior ya no existe o ya no tienes acceso. Crea una sala o entra con un codigo nuevo.');
            return;
          }
          setError(messageFrom(cause));
        });
      })
      .catch((cause) => setError(messageFrom(cause)));
    return () => unsubscribe();
  }, [session]);

  const handleEnter = async (operation) => {
    setBusy(true); setError('');
    try { setSession(await operation()); }
    catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(false); }
  };

  const dispatch = useCallback(async (type, payload = {}) => {
    if (!view?.publicState || busy) return;
    setBusy(true); setError('');
    try { await executeGameAction(session.gameId, view.publicState.version, type, payload); }
    catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(false); }
  }, [busy, session, view]);

  if (!session) return <Lobby onCreateRoom={(name) => handleEnter(() => createGame(name))} onJoinRoom={(code, name) => handleEnter(() => joinGame(code, name))} busy={busy} error={error} />;
  if (!view) return <Loading error={error} />;

  const { publicState: game, privateState } = view;
  const me = game.players?.[privateState.playerId];

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      {error && <div role="alert" className="fixed top-3 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-100 shadow-xl">{error}</div>}
      {game.phase === 'LOBBY' && <WaitingRoom roomCode={game.inviteCode} players={game.players} isHost={me?.isHost} onStartGame={() => dispatch('START_GAME')} busy={busy} />}
      {game.phase === 'DAWN' && <NightFirst game={game} privateState={privateState} onAction={dispatch} busy={busy} />}
      {game.phase === 'DAY' && <GameBoard game={game} privateState={privateState} onAction={dispatch} busy={busy} />}
      {game.phase === 'NIGHT' && <NightFirst game={game} privateState={privateState} onAction={dispatch} busy={busy} />}
      <SpecialEvents game={game} privateState={privateState} onAction={dispatch} busy={busy} />
      <TimeoutControl action={privateState.legalActions?.find((item) => item.type === 'APPLY_TIMEOUT')} onApply={() => dispatch('APPLY_TIMEOUT')} busy={busy} />
    </main>
  );
}

function Loading({ error }) {
  return <div className="grid min-h-screen place-items-center bg-stone-950 p-6 text-center text-stone-300"><div><div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" /><p>{error || 'Restaurando tu partida de Salem...'}</p></div></div>;
}

function TimeoutControl({ action, onApply, busy }) {
  const [now, setNow] = useState(0);
  const attemptedTimeout = useRef(null);
  useEffect(() => {
    if (!action) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [action]);
  useEffect(() => {
    if (!action || busy || now === 0 || now < action.phaseEndsAt || attemptedTimeout.current === action.phaseEndsAt) return undefined;
    attemptedTimeout.current = action.phaseEndsAt;
    const automatic = setTimeout(onApply, 250);
    return () => clearTimeout(automatic);
  }, [action, busy, now, onApply]);
  if (!action) return null;
  const seconds = now === 0 ? null : Math.max(0, Math.ceil((action.phaseEndsAt - now) / 1000));
  return <button type="button" disabled={busy || seconds === null || seconds > 0} onClick={onApply} className="fixed bottom-3 right-3 z-[65] rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-[11px] font-bold text-stone-300 shadow-lg disabled:opacity-60">{seconds === null ? 'Sincronizando reloj...' : seconds ? `Timeout en ${seconds}s` : busy ? 'Resolviendo timeout...' : 'Resolviendo automaticamente...'}</button>;
}
