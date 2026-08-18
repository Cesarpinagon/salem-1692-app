import { useState } from 'react';
import { Eye, EyeOff, Moon, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { subPhaseLabel, tryalLabel } from '../utils/gameLabels';

const legal = (privateState, type) => privateState.legalActions?.find((action) => action.type === type);

export function NightFirst({ game, privateState, onAction, busy }) {
  const [revealed, setRevealed] = useState(false);
  const me = game.players[privateState.playerId];
  const blackCat = legal(privateState, 'SELECT_BLACK_CAT');
  const victim = legal(privateState, 'SELECT_WITCH_VICTIM');
  const protection = legal(privateState, 'SELECT_CONSTABLE_PROTECTION');
  const confession = legal(privateState, 'CONFESS');
  const canPassConfession = legal(privateState, 'PASS_CONFESSION');

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-5 p-4 text-center">
      <div><Moon className="mx-auto mb-3 h-12 w-12 text-purple-400" /><p className="text-xs font-bold uppercase tracking-[.3em] text-purple-400">{game.phase === 'DAWN' ? 'Amanecer secreto' : subPhaseLabel(game.subPhase)}</p><h1 className="mt-2 font-serif text-3xl font-bold">Protege tu pantalla</h1><p className="mt-2 text-sm text-stone-400">La informacion de esta vista solo fue enviada a {me?.name}.</p></div>

      <section className="w-full rounded-2xl border border-purple-900 bg-stone-900 p-5 shadow-2xl">
        {revealed ? <Identity privateState={privateState} /> : <div className="py-8"><EyeOff className="mx-auto h-12 w-12 text-stone-600" /><p className="mt-2 text-sm text-stone-500">Identidad oculta</p></div>}
        <button onClick={() => setRevealed(!revealed)} className="mt-3 text-xs text-stone-400 underline">{revealed ? <EyeOff className="mr-1 inline h-4 w-4" /> : <Eye className="mr-1 inline h-4 w-4" />}{revealed ? 'Ocultar' : 'Revelar mi informacion'}</button>
      </section>

      <Decision title={blackCat ? 'Elige quien recibe el Gato Negro' : victim ? 'Seleccion secreta de victima' : protection ? 'Proteccion del Alguacil' : null} targets={(blackCat || victim || protection)?.targets} players={game.players} disabled={busy} onChoose={(targetId) => onAction(blackCat?.type || victim?.type || protection?.type, { targetId })} />
      {confession && <div className="w-full rounded-xl border border-stone-800 bg-stone-900 p-4"><p className="mb-3 text-sm">Puedes revelar voluntariamente una carta de Juicio para protegerte esta noche.</p><div className="flex flex-wrap justify-center gap-2">{privateState.tryalCards.filter((card) => !card.revealed).map((card, index) => <button key={card.id} disabled={busy} onClick={() => onAction('CONFESS', { tryalCardId: card.id })} className="rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-2 text-xs">Confesar carta {index + 1}</button>)}{canPassConfession && <button disabled={busy} onClick={() => onAction('PASS_CONFESSION')} className="rounded-lg border border-stone-600 bg-stone-800 px-4 py-2 text-xs">No confesar esta noche</button>}</div></div>}
    </div>
  );
}

function Identity({ privateState }) {
  const tone = privateState.hasEverBeenWitch ? 'text-red-400' : privateState.isCurrentConstable ? 'text-amber-400' : 'text-emerald-400';
  return <div className={tone}>{privateState.hasEverBeenWitch ? <Sparkles className="mx-auto h-10 w-10" /> : privateState.isCurrentConstable ? <ShieldAlert className="mx-auto h-10 w-10" /> : <UserCheck className="mx-auto h-10 w-10" />}<h2 className="mt-2 text-xl font-bold">{privateState.hasEverBeenWitch ? 'Perteneces al equipo de las Brujas' : privateState.isCurrentConstable ? 'Eres el Alguacil actual' : 'No has sido Bruja'}</h2><div className="mt-4 flex flex-wrap justify-center gap-2">{privateState.tryalCards?.map((card) => <span key={card.id} className="rounded border border-current/30 bg-black/20 px-2 py-1 text-[11px]">{tryalLabel(card.type)}{card.revealed ? ' · revelada' : ''}</span>)}</div>{privateState.knownWitches?.length > 0 && <p className="mt-4 text-xs">Brujas conocidas: {privateState.knownWitches.map((witch) => witch.name).join(', ')}</p>}</div>;
}

function Decision({ title, targets, players, disabled, onChoose }) {
  if (!title) return null;
  return <section className="w-full rounded-xl border border-purple-800 bg-purple-950/20 p-4"><h2 className="mb-3 text-sm font-bold text-purple-200">{title}</h2><div className="flex flex-wrap justify-center gap-2">{targets?.map((id) => <button key={id} disabled={disabled} onClick={() => onChoose(id)} className="rounded-lg border border-purple-700 bg-purple-900 px-4 py-2 text-xs font-bold disabled:opacity-50">{players[id]?.name}</button>)}</div></section>;
}
