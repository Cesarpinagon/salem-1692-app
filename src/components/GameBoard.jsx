import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Eye, Flame, Layers, Shield, User, Users } from 'lucide-react';
import { CARD_GLOSSARY, cardDescription, colorLabel, deathReasonLabel, tryalLabel } from '../utils/gameLabels';

const actionOf = (privateState, type) => privateState.legalActions?.find((action) => action.type === type);

export function GameBoard({ game, privateState, onAction, busy }) {
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [selectedAuxCardIds, setSelectedAuxCardIds] = useState([]);
  const playOptions = privateState.legalActions?.filter((action) => action.type === 'PLAY_CARD') || [];
  const playAction = playOptions.find((action) => action.cardId === selectedCardId);
  const isMyTurn = game.currentPlayerId === privateState.playerId;
  const selectedCard = privateState.hand?.find((card) => card.id === selectedCardId);
  const accusationLeader = useMemo(() => Object.values(game.players || {}).sort((a, b) => b.accusationTotal - a.accusationTotal)[0], [game.players]);

  const confirmCard = () => {
    const required = playAction?.targetCount || 0;
    if (!playAction || selectedTargets.length < required) return;
    const payload = {
      cardId: selectedCardId,
      targetId: required === 1 ? selectedTargets[0] : undefined,
      targetIds: required === 2 ? selectedTargets : undefined,
    };
    if (selectedCard?.key === 'ALIBI') payload.accusationCardIds = selectedAuxCardIds;
    if (selectedCard?.key === 'CURSE') payload.targetCardId = selectedAuxCardIds[0];
    onAction('PLAY_CARD', payload);
    setSelectedCardId(null); setSelectedTargets([]); setSelectedAuxCardIds([]);
  };

  const toggleTarget = (id) => {
    if (playAction?.targetCount === 2) {
      setSelectedTargets((current) => current.includes(id)
        ? current[0] === id ? [] : current.filter((item) => item !== id)
        : current.length < 2 ? [...current, id] : current);
    } else setSelectedTargets([id]);
    setSelectedAuxCardIds([]);
  };

  const auxOptions = selectedTargets.length === 1
    ? selectedCard?.key === 'ALIBI' ? playAction?.accusationOptions?.[selectedTargets[0]] || []
      : selectedCard?.key === 'CURSE' ? playAction?.blueCardOptions?.[selectedTargets[0]] || [] : []
    : [];
  const selectedAccusationPoints = auxOptions.filter((item) => selectedAuxCardIds.includes(item.id)).reduce((sum, item) => sum + item.points, 0);
  const needsAuxSelection = ['ALIBI', 'CURSE'].includes(selectedCard?.key);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-3 sm:p-5 lg:grid lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <header className="game-header rounded-2xl border p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[.22em] text-amber-500">Dia en Salem · turno {game.turn?.number}</p><h1 className="mt-1 font-serif text-xl font-bold">{isMyTurn ? 'Tu decision puede cambiar el pueblo' : `Turno de ${game.players?.[game.currentPlayerId]?.name || '...'}`}</h1></div>
            <div className="rounded-full border border-stone-700 bg-stone-950 px-3 py-1.5 text-xs text-stone-300">Mazo: {game.deckCount} · v{game.version}</div>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {game.turnOrder?.map((id) => {
            const player = game.players[id];
            const firstTargetPool = selectedCard?.key === 'SCAPEGOAT' ? playAction?.sourceTargets : playAction?.targets;
            const targetable = selectedTargets.length === 0
              ? firstTargetPool?.includes(id)
              : playAction?.orderedTargets
                ? selectedTargets.length === 1 ? playAction.targets?.includes(id) : selectedTargets.includes(id)
                : playAction?.targets?.includes(id);
            return (
              <button key={id} type="button" disabled={!targetable || busy} onClick={() => toggleTarget(id)} className={`player-card rounded-xl border p-4 text-left transition ${!player.alive ? 'border-stone-900 bg-stone-950 opacity-55' : id === game.currentPlayerId ? 'border-amber-600 bg-amber-950/20' : 'border-stone-800 bg-stone-900/90'} ${selectedTargets.includes(id) ? 'ring-2 ring-red-500' : ''} ${targetable ? 'cursor-pointer hover:border-red-600' : 'cursor-default'}`}>
                <div className="flex items-start justify-between gap-3"><div className="flex gap-2"><User className="mt-0.5 h-5 w-5 text-stone-500" /><div><p className="font-semibold">{player.name}{id === privateState.playerId && <span className="ml-1 text-xs text-stone-500">(tu)</span>}</p><p className="mt-0.5 text-xs text-stone-500">{player.alive ? 'Con vida' : `Espectador · ${deathReasonLabel(player.deathReason)}`}</p>{!player.alive && <p className={`mt-1 text-[10px] font-bold ${player.wasEverWitch ? 'text-red-400' : 'text-emerald-400'}`}>{player.wasEverWitch ? 'Fue Bruja durante la partida' : 'Nunca fue Bruja'}</p>}</div></div>{player.hasBlackCat && <span title="Gato Negro" className="text-lg">🐈‍⬛</span>}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]"><span className="rounded bg-stone-800 px-2 py-1"><Layers className="mr-1 inline h-3 w-3" />{player.handCount} en mano</span><span className="rounded bg-stone-800 px-2 py-1"><Eye className="mr-1 inline h-3 w-3" />{player.tryalCardCount} ocultas</span>{player.accusationTotal > 0 && <span className="rounded bg-red-950 px-2 py-1 text-red-300"><Flame className="mr-1 inline h-3 w-3" />{player.accusationTotal}/7</span>}{player.blueCards?.length > 0 && <span className="rounded bg-blue-950 px-2 py-1 text-blue-300"><Shield className="mr-1 inline h-3 w-3" />{player.blueCards.map((card) => card.name).join(', ')}</span>}{player.trapCardCount > 0 && <span className="rounded bg-emerald-950 px-2 py-1 text-emerald-300">Cepo ×{player.trapCardCount}</span>}</div>
                {player.matchmakerCardCount > 0 && <p className="mt-2 text-[10px] text-pink-300">{player.marriedTo ? `💍 Vinculado con ${game.players[player.marriedTo]?.name}` : '💌 Tiene una carta de Casamentero'}</p>}
                {player.revealedTryalCards?.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{player.revealedTryalCards.map((card) => <span key={card.id} className="rounded border border-stone-700 px-2 py-1 text-[10px] text-stone-300">{tryalLabel(card.type)}</span>)}</div>}
              </button>
            );
          })}
        </div>

        <History entries={game.history} />
      </section>

      <aside className="lg:sticky lg:top-5 lg:self-start">
        <section className="private-panel rounded-2xl border border-amber-900/50 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-500">Informacion privada</p><h2 className="font-serif text-lg font-bold">Mis cartas</h2></div><span className="rounded-full bg-stone-800 px-2 py-1 text-xs">{privateState.hand?.length || 0}</span></div>
          <div className="flex gap-2 overflow-x-auto pb-3 lg:grid lg:max-h-[360px] lg:grid-cols-2 lg:overflow-y-auto">
            {privateState.hand?.map((card) => {
              const legal = playOptions.some((option) => option.cardId === card.id);
              return <button type="button" key={card.id} disabled={!legal || busy} onClick={() => { setSelectedCardId(selectedCardId === card.id ? null : card.id); setSelectedTargets([]); setSelectedAuxCardIds([]); }} className={`min-h-32 min-w-28 rounded-xl border p-3 text-left transition lg:min-w-0 ${selectedCardId === card.id ? 'border-amber-400 bg-amber-950/40 -translate-y-1' : 'border-stone-700 bg-stone-800'} disabled:cursor-not-allowed disabled:opacity-50`}><span className={`text-[9px] font-bold ${card.color === 'RED' ? 'text-red-400' : card.color === 'BLUE' ? 'text-blue-400' : card.color === 'BLACK' ? 'text-stone-300' : 'text-emerald-400'}`}>{colorLabel(card.color)}</span><strong className="mt-1 block text-sm">{card.name}</strong><span className="mt-2 block text-[10px] text-stone-400">{cardDescription(card)}</span></button>;
            })}
          </div>

          <section className="mb-3 border-t border-stone-800 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">Sólo tú puedes verlas</p><h3 className="text-sm font-bold text-stone-200">Mis cartas de Juicio</h3></div>
              <div className="flex flex-wrap gap-1 text-[10px]"><span className={`rounded-full px-2 py-1 font-bold ${privateState.hasEverBeenWitch ? 'bg-red-950 text-red-300' : 'bg-emerald-950 text-emerald-300'}`}>{privateState.hasEverBeenWitch ? 'Equipo Brujas' : 'Equipo Pueblo'}</span>{privateState.isCurrentConstable && <span className="rounded-full bg-amber-950 px-2 py-1 font-bold text-amber-300">Alguacil actual</span>}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {privateState.tryalCards?.map((card, index) => <div key={card.id} className={`rounded-lg border p-2 ${card.type === 'WITCH' ? 'border-red-900 bg-red-950/30 text-red-200' : card.type === 'CONSTABLE' ? 'border-amber-900 bg-amber-950/30 text-amber-200' : 'border-emerald-900 bg-emerald-950/20 text-emerald-200'} ${card.revealed ? 'opacity-55' : ''}`}><span className="block text-[9px] uppercase text-stone-500">Juicio {index + 1}</span><strong className="text-xs">{tryalLabel(card.type)}</strong>{card.revealed && <span className="ml-1 text-[9px] text-stone-400">· revelada</span>}</div>)}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2 border-t border-stone-800 pt-3">
            <button disabled={!actionOf(privateState, 'DRAW_CARDS') || busy} onClick={() => onAction('DRAW_CARDS')} className="rounded-lg bg-amber-700 px-3 py-2.5 text-xs font-bold disabled:opacity-35"><Layers className="mr-1 inline h-4 w-4" />Robar 2</button>
            <button disabled={!actionOf(privateState, 'END_TURN') || busy} onClick={() => onAction('END_TURN')} className="rounded-lg bg-stone-700 px-3 py-2.5 text-xs font-bold disabled:opacity-35"><CheckCircle2 className="mr-1 inline h-4 w-4" />Terminar</button>
          </div>
          {playAction?.orderedTargets && <p className="mt-2 text-xs text-stone-400">{selectedTargets.length === 0 ? 'Elige primero el origen.' : selectedTargets.length === 1 ? `Origen: ${game.players[selectedTargets[0]]?.name}. Ahora elige el destino.` : `Origen: ${game.players[selectedTargets[0]]?.name} · Destino: ${game.players[selectedTargets[1]]?.name}`}</p>}
          {auxOptions.length > 0 && <div className="mt-2 rounded-lg border border-stone-700 p-2"><p className="mb-2 text-[10px] font-bold uppercase text-stone-400">{selectedCard?.key === 'ALIBI' ? `Elige acusaciones (máximo 3 puntos · ${selectedAccusationPoints}/3)` : 'Elige la carta azul que será descartada'}</p><div className="flex flex-wrap gap-2">{auxOptions.map((option) => { const selected = selectedAuxCardIds.includes(option.id); const disabled = selectedCard?.key === 'ALIBI' && !selected && selectedAccusationPoints + option.points > 3; return <button type="button" key={option.id} disabled={disabled} onClick={() => setSelectedAuxCardIds((current) => selectedCard?.key === 'CURSE' ? [option.id] : current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id])} className={`rounded border px-2 py-1 text-xs ${selected ? 'border-amber-400 bg-amber-950' : 'border-stone-700 bg-stone-800'} disabled:opacity-30`}>{option.name}{option.points ? ` · ${option.points} pt` : ''}</button>; })}</div></div>}
          {selectedCard && <button disabled={busy || selectedTargets.length < (playAction?.targetCount || 0) || (needsAuxSelection && selectedAuxCardIds.length === 0)} onClick={confirmCard} className="mt-2 w-full rounded-lg bg-red-800 px-3 py-2.5 text-xs font-bold disabled:opacity-35">Jugar {selectedCard.name}{playAction?.targetCount ? selectedTargets.length ? ` con ${selectedTargets.map((id) => game.players[id]?.name).join(' → ')}` : ` · elige ${playAction.targetCount === 2 ? 'dos jugadores' : 'un objetivo'}` : ''}</button>}
          {privateState.lastConspiracyCard && <div className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200"><strong>Ultima Conspiracion:</strong> tomaste de {privateState.lastConspiracyCard.fromName} una carta de <strong>{tryalLabel(privateState.lastConspiracyCard.type)}</strong>.</div>}
          {accusationLeader?.accusationTotal > 0 && <p className="mt-3 text-center text-[10px] text-stone-500"><Users className="mr-1 inline h-3 w-3" />Mayor acusacion: {accusationLeader.name} ({accusationLeader.accusationTotal})</p>}
        </section>
        <CardGlossary />
      </aside>
    </div>
  );
}

function CardGlossary() {
  return <details className="mt-3 rounded-xl border border-stone-800 bg-stone-900 p-4"><summary className="cursor-pointer text-sm font-bold text-stone-300"><BookOpen className="mr-2 inline h-4 w-4" />Glosario de cartas</summary><div className="mt-3 space-y-3 text-xs text-stone-400"><p><strong className="text-stone-200">Cartas de Juicio:</strong> Bruja · Pueblerino · Alguacil.</p>{CARD_GLOSSARY.map((item) => <p key={item.name}><strong className="text-amber-300">{item.name}:</strong> {item.description}</p>)}</div></details>;
}

function History({ entries = [] }) {
  return <details className="rounded-xl border border-stone-800 bg-stone-900 p-4"><summary className="cursor-pointer text-sm font-bold text-stone-300"><BookOpen className="mr-2 inline h-4 w-4" />Historial publico</summary><ol className="mt-3 max-h-56 space-y-2 overflow-y-auto text-xs text-stone-400">{[...entries].reverse().map((entry) => <li key={entry.id} className="border-l border-stone-700 pl-3">{entry.message}</li>)}</ol></details>;
}
