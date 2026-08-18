import { useState } from 'react';
import { EyeOff, Flame, RefreshCw, Trophy } from 'lucide-react';
import { winnerLabel } from '../utils/gameLabels';

const legal = (privateState, type) => privateState.legalActions?.find((action) => action.type === type);

export function SpecialEvents({ game, privateState, onAction, busy }) {
  const [conspiracyChoice, setConspiracyChoice] = useState(null);
  const tryal = legal(privateState, 'SELECT_TRYAL');
  if (game.subPhase === 'TRYAL_SELECTION' && tryal) return <Overlay><Flame className="mx-auto h-12 w-12 text-red-500" /><h2 className="mt-3 text-xl font-bold text-red-300">Selecciona una carta de Juicio</h2><p className="mt-2 text-sm text-stone-400">{game.pendingAction?.reason === 'BLACK_CAT' ? `El Gato Negro obliga a ${game.players[tryal.targetId]?.name} a revelar una carta.` : `La acusacion llevo a ${game.players[tryal.targetId]?.name} a Juicio.`}</p><div className="mt-5 grid grid-cols-2 gap-2">{tryal.tryalOptions?.map((id, index) => <button key={id} disabled={busy} onClick={() => onAction('SELECT_TRYAL', { targetId: tryal.targetId, tryalCardId: id })} className="h-24 rounded-xl border-2 border-stone-700 bg-stone-800 font-bold text-amber-200 hover:border-amber-500 disabled:opacity-50">Carta oculta {index + 1}</button>)}</div></Overlay>;

  const conspiracy = legal(privateState, 'SELECT_CONSPIRACY_CARD');
  if (game.subPhase === 'CONSPIRACY_RESOLUTION') return <Overlay><RefreshCw className="mx-auto h-12 w-12 text-amber-500" /><h2 className="mt-3 text-xl font-bold text-amber-300">Conspiracion</h2>{conspiracy ? <><p className="mt-2 text-sm text-stone-400">Tomando una carta oculta de <strong className="text-amber-200">{conspiracy.sourceName}</strong>, el jugador a tu izquierda.</p><div className="mt-5 grid grid-cols-2 gap-2">{conspiracy.tryalOptions?.map((choice, index) => <button key={choice} disabled={busy} onClick={() => setConspiracyChoice(choice)} className={`h-20 rounded-xl border bg-amber-950/30 text-sm disabled:opacity-50 ${conspiracyChoice === choice ? 'border-amber-300 ring-2 ring-amber-500/50' : 'border-amber-800'}`}>Carta oculta {index + 1}</button>)}</div>{conspiracyChoice !== null && <><p className="mt-4 text-sm text-amber-200">Seleccionaste la carta oculta {conspiracyChoice + 1} de {conspiracy.sourceName}.</p><button disabled={busy} onClick={() => { onAction('SELECT_CONSPIRACY_CARD', { tryalCardIndex: conspiracyChoice }); setConspiracyChoice(null); }} className="mt-3 w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-bold text-stone-950 disabled:opacity-50">Confirmar y agregar a mis cartas</button></>}</> : <p className="mt-3 text-sm text-stone-500">Tu carta ya fue elegida. Esperando las decisiones privadas de los demas jugadores...</p>}</Overlay>;

  if (game.subPhase === 'LAST_WORDS') {
    const canEnd = legal(privateState, 'END_LAST_WORDS');
    const canSubmit = legal(privateState, 'SUBMIT_LAST_WORDS');
    return <Overlay><EyeOff className="mx-auto h-12 w-12 text-stone-400" /><h2 className="mt-3 text-xl font-bold">Ultimas palabras</h2><p className="mt-2 text-sm text-stone-400">{game.players[game.pendingAction?.deceasedId]?.name} puede enviar su despedida antes de pasar a modo espectador.</p>{canSubmit && <LastWordsForm busy={busy} onSubmit={(message) => onAction('SUBMIT_LAST_WORDS', { message })} />}{canEnd && <button disabled={busy} onClick={() => onAction('END_LAST_WORDS')} className="mt-3 rounded-lg bg-stone-700 px-5 py-2 text-sm font-bold">Omitir</button>}</Overlay>;
  }
  if (game.phase === 'FINISHED') {
    const canReset = legal(privateState, 'RESET_GAME');
    return <Overlay><Trophy className="mx-auto h-14 w-14 text-amber-400" /><h2 className="mt-3 font-serif text-3xl font-bold">Fin de la partida</h2><p className="mt-2 text-lg text-amber-300">Ganador: {winnerLabel(game.winner)}</p>{canReset ? <button type="button" disabled={busy} onClick={() => onAction('RESET_GAME')} className="mt-6 w-full rounded-xl bg-amber-600 px-5 py-3 font-bold text-stone-950 transition hover:bg-amber-500 disabled:cursor-wait disabled:opacity-50">{busy ? 'Reiniciando...' : 'Jugar otra vez'}</button> : <p className="mt-5 text-sm text-stone-400">Esperando a que el anfitrion inicie una nueva partida...</p>}<p className="mt-4 text-xs text-stone-500">Se conservaran la sala y los jugadores.</p></Overlay>;
  }
  return null;
}

function LastWordsForm({ busy, onSubmit }) {
  const [message, setMessage] = useState('');
  return <form className="mt-4" onSubmit={(event) => { event.preventDefault(); if (message.trim()) onSubmit(message); }}><textarea maxLength="160" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escribe hasta 160 caracteres..." className="h-24 w-full rounded-lg border border-stone-700 bg-stone-950 p-3 text-sm text-stone-100" /><button disabled={busy || !message.trim()} className="mt-2 w-full rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold disabled:opacity-40">Enviar ultimas palabras</button></form>;
}

function Overlay({ children }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4"><section className="w-full max-w-sm rounded-2xl border border-stone-700 bg-stone-900 p-6 text-center shadow-2xl">{children}</section></div>;
}
