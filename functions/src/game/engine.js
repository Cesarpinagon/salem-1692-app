import {
  ACCUSATION_THRESHOLD, ACTION, CARD_COLOR, DECISION_TIMEOUT_MS, EVENT, GAME_STATUS,
  MAX_PLAYERS, MIN_PLAYERS, SUB_PHASE, TRYAL,
} from './constants.js';
import { buildTownDeck, getCardDefinition } from './cards.js';

const clone = (value) => structuredClone(value);
const nowIso = (now) => new Date(now).toISOString();

export function hydrateGameState(gameInput) {
  const game = clone(gameInput);
  const normalizeCard = (card) => {
    if (!card?.key) return card;
    const definition = getCardDefinition(card.key);
    return definition ? Object.assign(card, definition, { id: card.id }) : card;
  };
  const arrayFields = ['deck', 'discard', 'retiredCards', 'effects', 'history', 'events', 'internalLog', 'randomAudit', 'turnOrder'];
  arrayFields.forEach((field) => { game[field] = Array.isArray(game[field]) ? game[field] : []; });
  ['deck', 'discard', 'retiredCards'].forEach((field) => game[field].forEach(normalizeCard));
  game.players ||= {};
  game.pendingActions ||= {};
  game.pendingActions.conspiracySelections ||= {};
  game.pendingActions.witchVotes ||= {};
  game.pendingActions.confessions ||= {};
  game.pendingActions.confessionResponses ||= {};
  game.processedActionIds ||= {};
  game.timers ||= { phaseEndsAt: null };
  game.turn ||= { number: 0, index: 0, mode: null };
  game.nextEventId ??= 1;
  game.interruptedTurn ||= null;
  game.setupBlackCat ||= null;
  const conspiracyInLegacyHands = [];
  Object.values(game.players).forEach((player) => {
    ['hand', 'tryalCards', 'blueCards', 'matchmakerCards', 'trapCards', 'accusations', 'secretInformation'].forEach((field) => {
      player[field] = Array.isArray(player[field]) ? player[field] : [];
    });
    player.alive ??= true;
    player.connected ??= false;
    player.canCommunicate ??= true;
    player.accusationTotal ??= 0;
    player.hasEverBeenWitch ??= false;
    player.isCurrentWitch ??= false;
    player.isCurrentConstable ??= false;
    player.blueCards.push(...player.matchmakerCards.filter((card) => !player.blueCards.some((item) => item.id === card.id)));
    player.matchmakerCards = [];
    player.hasBlackCat = player.blueCards.some((card) => card.key === 'BLACK_CAT');
    player.protectedTonight ??= false;
    player.confessedTonight ??= false;
    player.marriedTo ??= null;
    player.lastConspiracyCard ??= null;
    player.wasWitchAnnounced ??= false;
    conspiracyInLegacyHands.push(...player.hand.filter((card) => card.key === 'CONSPIRACY'));
    player.hand = player.hand.filter((card) => card.key !== 'CONSPIRACY');
    [...player.hand, ...player.blueCards, ...player.trapCards, ...player.accusations].forEach(normalizeCard);
  });
  let asylumKept = false;
  const keepSingleAsylum = (cards) => cards.filter((card) => {
    if (card.key !== 'ASYLUM') return true;
    if (asylumKept) return false;
    asylumKept = true;
    return true;
  });
  Object.values(game.players).forEach((player) => { player.blueCards = keepSingleAsylum(player.blueCards); });
  Object.values(game.players).forEach((player) => { player.hand = keepSingleAsylum(player.hand); });
  game.deck = keepSingleAsylum(game.deck);
  game.discard = keepSingleAsylum(game.discard);
  const conspiracyAlreadyInCycle = [...game.deck, ...game.discard].some((card) => card.key === 'CONSPIRACY');
  if (!conspiracyAlreadyInCycle && conspiracyInLegacyHands.length) game.deck.push(conspiracyInLegacyHands[0]);
  return game;
}

export class GameRuleError extends Error {
  constructor(code, message) { super(message); this.name = 'GameRuleError'; this.code = code; }
}

const assertRule = (condition, code, message) => {
  if (!condition) throw new GameRuleError(code, message);
};

const tryalName = (type) => ({
  [TRYAL.WITCH]: 'Bruja',
  [TRYAL.NOT_WITCH]: 'Pueblerino',
  [TRYAL.CONSTABLE]: 'Alguacil',
}[type] || type);

const hasAsylum = (player) => player.blueCards.some((card) => ['ASYLUM', 'SANCTUARY'].includes(card.key));

function shuffled(items, rng, audit) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const sample = rng();
    const j = Math.floor(sample * (i + 1));
    audit.push({ range: i + 1, sample, selected: j });
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function stateHash(game) {
  const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    return value;
  };
  const text = JSON.stringify(stable(game));
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function publicEvent(game, type, message, data = {}, at = Date.now()) {
  const entry = { id: `event_${game.nextEventId++}`, type, message, data, at: nowIso(at), version: game.version + 1 };
  game.events.push(entry);
  game.history.push(entry);
  return entry;
}

function setDecisionTimer(game, at, timeoutMs = DECISION_TIMEOUT_MS) {
  game.timers.phaseEndsAt = at + timeoutMs;
}

function playerTemplate({ id, firebaseUid, name, isHost = false }) {
  return {
    id, firebaseUid, name, alive: true, connected: true, isHost, character: null, hand: [], tryalCards: [],
    blueCards: [], trapCards: [], accusations: [], accusationTotal: 0, hasEverBeenWitch: false, isCurrentWitch: false,
    isCurrentConstable: false, hasBlackCat: false, protectedTonight: false, confessedTonight: false,
    canCommunicate: true, secretInformation: [], deathReason: null, matchmakerCards: [], marriedTo: null, lastConspiracyCard: null,
  };
}

export function createGame({ id, inviteCode, host, now = Date.now() }) {
  assertRule(id && inviteCode && host?.id && host?.firebaseUid && host?.name, 'INVALID_GAME', 'Faltan datos para crear la partida.');
  return {
    id, inviteCode, status: GAME_STATUS.LOBBY, phase: GAME_STATUS.LOBBY, subPhase: null, round: 0,
    turn: { number: 0, index: 0, mode: null }, currentPlayerId: null, version: 0,
    createdAt: nowIso(now), updatedAt: nowIso(now), deck: [], discard: [], retiredCards: [], players: {
      [host.id]: playerTemplate({ ...host, isHost: true }),
    }, turnOrder: [host.id], effects: [], pendingActions: {}, timers: { phaseEndsAt: null }, history: [],
    events: [], internalLog: [], processedActionIds: {}, winner: null, nextEventId: 1, randomAudit: [],
    setupBlackCat: null,
  };
}

export function addPlayer(gameInput, player, now = Date.now()) {
  const game = hydrateGameState(gameInput);
  assertRule(game.status === GAME_STATUS.LOBBY, 'GAME_ALREADY_STARTED', 'La partida ya comenzo.');
  assertRule(!game.players[player.id], 'PLAYER_EXISTS', 'El jugador ya pertenece a la sala.');
  assertRule(game.turnOrder.length < MAX_PLAYERS, 'ROOM_FULL', 'La sala esta llena.');
  game.players[player.id] = playerTemplate(player);
  game.turnOrder.push(player.id);
  game.version += 1;
  game.updatedAt = nowIso(now);
  return game;
}

function assignTryals(game, rng) {
  const count = game.turnOrder.length <= 7 ? 5 : game.turnOrder.length <= 9 ? 4 : 3;
  const total = game.turnOrder.length * count;
  const cards = [
    { id: 'tryal_witch', type: TRYAL.WITCH, revealed: false },
    { id: 'tryal_constable', type: TRYAL.CONSTABLE, revealed: false },
    ...Array.from({ length: total - 2 }, (_, i) => ({ id: `tryal_not_witch_${i}`, type: TRYAL.NOT_WITCH, revealed: false })),
  ];
  const deck = shuffled(cards, rng, game.randomAudit);
  game.turnOrder.forEach((id, index) => { game.players[id].tryalCards = deck.slice(index * count, (index + 1) * count); });
}

function recalculateRoles(game) {
  game.turnOrder.forEach((id) => {
    const player = game.players[id];
    const wasWitch = player.isCurrentWitch;
    const wasConstable = player.isCurrentConstable;
    player.isCurrentWitch = player.tryalCards.some((card) => card.type === TRYAL.WITCH && !card.revealed);
    player.isCurrentConstable = player.tryalCards.some((card) => card.type === TRYAL.CONSTABLE && !card.revealed);
    if (player.isCurrentWitch) player.hasEverBeenWitch = true;
    if (!wasWitch && player.isCurrentWitch) player.secretInformation.push({ type: EVENT.PLAYER_BECAME_WITCH, message: 'Ahora perteneces al equipo de las Brujas.' });
    if (wasConstable !== player.isCurrentConstable && player.isCurrentConstable) player.secretInformation.push({ type: EVENT.ROLE_CHANGED, message: 'Ahora eres el Alguacil.' });
  });
}

function startGame(game, playerId, rng, at) {
  assertRule(game.players[playerId]?.isHost, 'HOST_ONLY', 'Solo el anfitrion puede iniciar.');
  assertRule(game.turnOrder.length >= MIN_PLAYERS && game.turnOrder.length <= MAX_PLAYERS, 'INVALID_PLAYER_COUNT', `Se requieren entre ${MIN_PLAYERS} y ${MAX_PLAYERS} jugadores.`);
  assertRule(game.turnOrder.every((id) => game.players[id].connected), 'PLAYERS_DISCONNECTED', 'Todos los jugadores deben estar conectados.');
  game.status = GAME_STATUS.SETUP;
  game.phase = GAME_STATUS.SETUP;
  assignTryals(game, rng);
  recalculateRoles(game, at);
  game.turnOrder.forEach((id, index) => {
    game.players[id].character = {
      id: `resident_${index + 1}`,
      name: 'Habitante de Salem',
      description: 'Personaje base; las habilidades oficiales se activaran cuando se configure el catalogo.',
      effect: null,
      trigger: null,
      limitations: [],
    };
  });
  const completeDeck = buildTownDeck();
  const blackCat = completeDeck.find((card) => card.key === 'BLACK_CAT');
  const conspiracy = completeDeck.find((card) => card.key === 'CONSPIRACY');
  const night = completeDeck.find((card) => card.key === 'NIGHT');
  game.deck = shuffled(completeDeck.filter((card) => !['BLACK_CAT', 'CONSPIRACY', 'NIGHT'].includes(card.key)), rng, game.randomAudit);
  game.turnOrder.forEach((id) => { game.players[id].hand = game.deck.splice(0, 3); });
  assertRule(game.turnOrder.every((id) => game.players[id].hand.length === 3), 'DECK_TOO_SMALL', 'El mazo no alcanzo para repartir las manos iniciales.');
  game.deck = [...shuffled([...game.deck, conspiracy], rng, game.randomAudit), night];
  game.setupBlackCat = blackCat;
  game.status = GAME_STATUS.DAWN;
  game.phase = GAME_STATUS.DAWN;
  game.subPhase = 'BLACK_CAT_SELECTION';
  setDecisionTimer(game, at);
  publicEvent(game, 'DAWN_STARTED', 'Comenzo el amanecer. Protege tu informacion privada.', {}, at);
}

function resetGame(game, playerId, at) {
  assertRule(game.status === GAME_STATUS.FINISHED && game.subPhase !== SUB_PHASE.LAST_WORDS, 'GAME_NOT_FINISHED', 'La partida debe haber terminado para reiniciarla.');
  assertRule(game.players[playerId]?.isHost, 'HOST_ONLY', 'Solo el anfitrion puede reiniciar la partida.');

  const players = Object.fromEntries(game.turnOrder.map((id) => {
    const current = game.players[id];
    const reset = playerTemplate({
      id: current.id,
      firebaseUid: current.firebaseUid,
      name: current.name,
      isHost: current.isHost,
    });
    reset.connected = current.connected;
    return [id, reset];
  }));

  Object.assign(game, {
    status: GAME_STATUS.LOBBY,
    phase: GAME_STATUS.LOBBY,
    subPhase: null,
    round: 0,
    turn: { number: 0, index: 0, mode: null },
    currentPlayerId: null,
    deck: [],
    discard: [],
    retiredCards: [],
    players,
    effects: [],
    pendingActions: {},
    timers: { phaseEndsAt: null },
    history: [],
    events: [],
    internalLog: [],
    processedActionIds: {},
    winner: null,
    nextEventId: 1,
    randomAudit: [],
    interruptedTurn: null,
    setupBlackCat: null,
    updatedAt: nowIso(at),
  });
}

function beginDay(game, at) {
  game.status = GAME_STATUS.DAY;
  game.phase = GAME_STATUS.DAY;
  game.subPhase = SUB_PHASE.WAITING_ACTION;
  game.turn.number += 1;
  game.turn.index = game.turnOrder.findIndex((id) => game.players[id].alive);
  game.turn.mode = null;
  game.currentPlayerId = game.turnOrder[game.turn.index];
  setDecisionTimer(game, at);
  publicEvent(game, EVENT.TURN_STARTED, `Comenzo el turno de ${game.players[game.currentPlayerId].name}.`, { playerId: game.currentPlayerId }, at);
}

function selectBlackCat(game, playerId, targetId, at) {
  assertRule(game.phase === GAME_STATUS.DAWN && game.subPhase === 'BLACK_CAT_SELECTION', 'WRONG_PHASE', 'No es momento de elegir el Gato Negro.');
  assertRule(game.players[playerId].alive && game.players[playerId].isCurrentWitch, 'NOT_ALLOWED', 'Solo la Bruja actual puede elegir el Gato Negro.');
  assertRule(game.players[targetId]?.alive, 'INVALID_TARGET', 'Debes asignar el Gato Negro a un jugador vivo.');
  assertRule(game.setupBlackCat?.key === 'BLACK_CAT', 'BLACK_CAT_MISSING', 'No se encontro la carta de Gato Negro de la preparacion.');
  game.players[targetId].blueCards.push(game.setupBlackCat);
  game.setupBlackCat = null;
  syncSpecialCards(game);
  game.pendingActions = {};
  publicEvent(game, 'BLACK_CAT_ASSIGNED', `${game.players[targetId].name} recibio el Gato Negro boca arriba.`, { targetId }, at);
  beginDay(game, at);
}

function frontCardCount(player) {
  return player.accusations.length + player.blueCards.length + player.trapCards.length;
}

function syncSpecialCards(game) {
  game.turnOrder.forEach((id) => {
    game.players[id].hasBlackCat = game.players[id].blueCards.some((card) => card.key === 'BLACK_CAT');
  });
}

function recalculateMarriages(game, at, announce = false) {
  const previousPairs = new Set(game.turnOrder.flatMap((id) => {
    const partner = game.players[id].marriedTo;
    return partner ? [[id, partner].sort().join(':')] : [];
  }));
  game.turnOrder.forEach((id) => { game.players[id].marriedTo = null; });
  game.effects = game.effects.filter((effect) => effect.type !== 'MARRIAGE');
  const placements = game.turnOrder.flatMap((id) => game.players[id].blueCards
    .filter((card) => card.key === 'MATCHMAKER').map((card) => ({ playerId: id, card })));
  if (placements.length !== 2) return;
  if (placements[0].playerId === placements[1].playerId) {
    const owner = game.players[placements[0].playerId];
    const ids = new Set(placements.map(({ card }) => card.id));
    owner.blueCards = owner.blueCards.filter((card) => !ids.has(card.id));
    game.discard.push(...placements.map(({ card }) => card));
    if (announce) publicEvent(game, 'MATCHMAKERS_DISCARDED', `Las dos cartas de Casamentero terminaron frente a ${owner.name} y fueron descartadas.`, { playerId: owner.id }, at);
    return;
  }
  const [firstId, secondId] = placements.map(({ playerId }) => playerId);
  game.players[firstId].marriedTo = secondId;
  game.players[secondId].marriedTo = firstId;
  game.effects.push({ type: 'MARRIAGE', targetIds: [firstId, secondId], cardIds: placements.map(({ card }) => card.id), visibility: 'PUBLIC', duration: 'PERMANENT' });
  const pairKey = [firstId, secondId].sort().join(':');
  if (announce && !previousPairs.has(pairKey)) {
    publicEvent(game, EVENT.MARRIAGE_CREATED, `${game.players[firstId].name} y ${game.players[secondId].name} quedaron unidos por Casamentero.`, { playerIds: [firstId, secondId] }, at);
  }
}

function validTargets(game, playerId, card) {
  const alive = game.turnOrder.filter((id) => game.players[id].alive
    && (card.color !== CARD_COLOR.RED || (game.players[id].tryalCards.some((tryal) => !tryal.revealed)
      && !game.players[id].blueCards.some((blueCard) => blueCard.key === 'MERCY'))));
  if (card.key === 'ALIBI') return alive.filter((id) => id !== playerId
    && game.players[id].accusations.some((accusation) => (accusation.points || 0) <= 3));
  if (card.key === 'CURSE') return alive.filter((id) => id !== playerId && game.players[id].blueCards.length > 0);
  if (['ROBBERY', 'SCAPEGOAT'].includes(card.key)) return alive.filter((id) => id !== playerId);
  if (card.targetRules === 'SELF') return [playerId];
  if (card.targetRules === 'OTHER_PLAYER') return alive.filter((id) => id !== playerId);
  if (card.targetRules === 'ANY_ALIVE_PLAYER') return alive;
  if (card.targetRules === 'TWO_ALIVE_PLAYERS') return alive.filter((id) => !game.players[id].marriedTo);
  return [];
}

function startNight(game, at, drawResume = null) {
  game.status = GAME_STATUS.NIGHT;
  game.phase = GAME_STATUS.NIGHT;
  game.subPhase = SUB_PHASE.WITCH_SELECTION;
  game.pendingActions = { witchVotes: {}, protection: null, confessions: {} };
  game.interruptedTurn = drawResume;
  setDecisionTimer(game, at);
  publicEvent(game, EVENT.NIGHT_STARTED, 'Comenzo la noche.', {}, at);
}

function beginConspiracy(game, at) {
  game.subPhase = SUB_PHASE.CONSPIRACY_RESOLUTION;
  game.pendingActions = { conspiracySelections: {} };
  setDecisionTimer(game, at);
  publicEvent(game, 'CONSPIRACY_STARTED', 'Comenzo una Conspiracion: todos eligen simultaneamente una carta de Juicio del jugador de su izquierda.', {}, at);
}

function resolveDrawnCard(game, playerId, card, remainingDraws, at) {
  publicEvent(game, EVENT.CARD_DRAWN, `${game.players[playerId].name} robo una carta.`, { color: card.color }, at);
  const drawResume = remainingDraws > 0 ? { playerId, remainingDraws } : null;
  if (card.color !== CARD_COLOR.BLACK) {
    game.players[playerId].hand.push(card);
    return false;
  }
  game.discard.push(card);
  if (card.key === 'CONSPIRACY') {
    game.interruptedTurn = drawResume;
    const blackCatId = game.turnOrder.find((id) => game.players[id].alive && game.players[id].hasBlackCat
      && game.players[id].tryalCards.some((tryal) => !tryal.revealed));
    if (blackCatId) {
      game.subPhase = SUB_PHASE.TRYAL_SELECTION;
      game.pendingActions = { accusedId: blackCatId, accuserId: blackCatId, resumeAfter: 'CONSPIRACY_START' };
      setDecisionTimer(game, at);
      publicEvent(game, 'BLACK_CAT_REVEAL', `${game.players[blackCatId].name} debe revelar una carta de Juicio antes de resolver Conspiracion.`, { targetId: blackCatId }, at);
    } else beginConspiracy(game, at);
    return true;
  }
  if (card.key === 'NIGHT') {
    startNight(game, at, drawResume);
    return true;
  }
  return false;
}

function recycleDiscard(game, rng) {
  const night = game.discard.find((card) => card.key === 'NIGHT')
    || game.deck.find((card) => card.key === 'NIGHT')
    || { ...getCardDefinition('NIGHT'), id: 'NIGHT_UNIQUE' };
  const reusableCards = [...game.deck, ...game.discard].filter((card) => card.key !== 'NIGHT');
  game.deck = [...shuffled(reusableCards, rng, game.randomAudit), night];
  game.discard = [];
}

function drawSequence(game, playerId, drawCount, rng, at) {
  for (let draw = 0; draw < drawCount; draw += 1) {
    if (!game.deck.length) recycleDiscard(game, rng);
    assertRule(game.deck.length, 'EMPTY_DECK', 'No hay cartas disponibles.');
    const card = game.deck.shift();
    const remainingDraws = drawCount - draw - 1;
    if (resolveDrawnCard(game, playerId, card, remainingDraws, at)) return;
  }
  game.interruptedTurn = null;
  endTurn(game, at);
}

function drawCards(game, playerId, rng, at) {
  game.turn.mode = 'DRAW';
  drawSequence(game, playerId, 2, rng, at);
}

function resumeInterruptedDraw(game, rng, at) {
  const resume = game.interruptedTurn;
  if (!resume?.remainingDraws) {
    game.interruptedTurn = null;
    if (game.phase === GAME_STATUS.DAY) endTurn(game, at);
    else beginDay(game, at);
    return;
  }
  if (!game.players[resume.playerId]?.alive) {
    game.status = GAME_STATUS.DAY;
    game.phase = GAME_STATUS.DAY;
    game.currentPlayerId = resume.playerId;
    game.turn.index = game.turnOrder.indexOf(resume.playerId);
    game.interruptedTurn = null;
    endTurn(game, at);
    return;
  }
  game.status = GAME_STATUS.DAY;
  game.phase = GAME_STATUS.DAY;
  game.subPhase = SUB_PHASE.WAITING_ACTION;
  game.currentPlayerId = resume.playerId;
  game.turn.index = game.turnOrder.indexOf(resume.playerId);
  game.interruptedTurn = null;
  drawSequence(game, resume.playerId, resume.remainingDraws, rng, at);
}

function playCard(game, playerId, payload, at) {
  assertRule(game.turn.mode !== 'DRAW', 'TURN_MODE_LOCKED', 'Ya elegiste robar en este turno.');
  const index = game.players[playerId].hand.findIndex((card) => card.id === payload.cardId);
  assertRule(index >= 0, 'CARD_NOT_OWNED', 'No posees esa carta.');
  const card = game.players[playerId].hand[index];
  assertRule(card.trigger === 'ON_PLAY', 'CARD_NOT_PLAYABLE', 'Esta carta no se juega desde la mano.');
  const targets = validTargets(game, playerId, card);
  const orderedTargetIds = Array.isArray(payload.targetIds) ? payload.targetIds : [];
  const targetIds = [...new Set(orderedTargetIds)];
  const targetId = payload.targetId ?? (card.targetRules === 'SELF' ? playerId : null);
  if (card.targetRules === 'TWO_ALIVE_PLAYERS') {
    assertRule(targetIds.length === 2 && targetIds.every((id) => targets.includes(id)), 'INVALID_TARGET', 'Debes elegir dos jugadores vivos y sin vinculo previo.');
  } else if (card.targetRules === 'TWO_OTHER_PLAYERS_ORDERED') {
    assertRule(orderedTargetIds.length === 2 && targetIds.length === 2 && targetIds.every((id) => targets.includes(id)), 'INVALID_TARGET', 'Debes elegir un jugador de origen y otro de destino, ambos distintos de ti.');
    if (card.key === 'SCAPEGOAT') assertRule(frontCardCount(game.players[orderedTargetIds[0]]) > 0, 'INVALID_TARGET', 'El jugador de origen no tiene cartas frente a el.');
  } else assertRule(card.targetRules === 'NONE' || targets.includes(targetId), 'INVALID_TARGET', 'El objetivo no es legal.');
  game.turn.mode = 'PLAY';
  game.subPhase = SUB_PHASE.PLAY_CARDS;
  game.players[playerId].hand.splice(index, 1);
  publicEvent(game, EVENT.CARD_PLAYED, `${game.players[playerId].name} jugo ${card.name}.`, { playerId, targetId, targetIds, card: card.key }, at);
  if (card.color === CARD_COLOR.RED) {
    const target = game.players[targetId];
    target.accusations.push({ ...card, sourceId: playerId });
    target.accusationTotal += card.points;
    publicEvent(game, EVENT.ACCUSATION_ADDED, `${target.name} tiene ${target.accusationTotal} puntos de acusacion.`, { targetId, total: target.accusationTotal }, at);
    if (target.accusationTotal >= ACCUSATION_THRESHOLD) {
      game.subPhase = SUB_PHASE.TRYAL_SELECTION;
      game.pendingActions = { accusedId: targetId, accuserId: playerId };
      setDecisionTimer(game, at);
    }
  } else if (card.key === 'ALIBI') {
    const target = game.players[targetId];
    const requestedIds = [...new Set(payload.accusationCardIds || [])];
    const removed = requestedIds.map((cardId) => target.accusations.find((accusation) => accusation.id === cardId || accusation.cardId === cardId)).filter(Boolean);
    const removedPoints = removed.reduce((total, accusation) => total + (accusation.points || 0), 0);
    assertRule(removed.length === requestedIds.length && removed.length > 0 && removedPoints <= 3, 'INVALID_ACCUSATIONS', 'Coartada debe retirar una o mas cartas que sumen como maximo 3 puntos.');
    const removedIds = new Set(removed.map((accusation) => accusation.id || accusation.cardId));
    target.accusations = target.accusations.filter((accusation) => !removedIds.has(accusation.id || accusation.cardId));
    target.accusationTotal = target.accusations.reduce((total, accusation) => total + (accusation.points || 0), 0);
    game.discard.push(...removed, card);
    publicEvent(game, 'ALIBI_APPLIED', `${game.players[playerId].name} retiro ${removedPoints} punto${removedPoints === 1 ? '' : 's'} de acusacion de ${target.name}.`, { playerId, targetId, removedCount: removed.length, removedPoints }, at);
  } else if (card.key === 'ARSON') {
    const target = game.players[targetId];
    game.discard.push(...target.hand, card);
    const discardedCount = target.hand.length;
    target.hand = [];
    publicEvent(game, 'ARSON_APPLIED', `${target.name} perdio las ${discardedCount} cartas de su mano por Incendio.`, { playerId, targetId, discardedCount }, at);
  } else if (card.key === 'CURSE') {
    const target = game.players[targetId];
    const blueIndex = target.blueCards.findIndex((blueCard) => blueCard.id === payload.targetCardId);
    assertRule(blueIndex >= 0, 'INVALID_BLUE_CARD', 'Debes elegir una carta azul situada frente al objetivo.');
    const [removed] = target.blueCards.splice(blueIndex, 1);
    game.discard.push(removed, card);
    syncSpecialCards(game);
    recalculateMarriages(game, at);
    publicEvent(game, 'CURSE_APPLIED', `${removed.name} fue descartada de frente a ${target.name}.`, { playerId, targetId, targetCardId: removed.id }, at);
  } else if (card.key === 'ROBBERY') {
    const [sourceId, recipientId] = orderedTargetIds;
    const stolen = game.players[sourceId].hand;
    game.players[sourceId].hand = [];
    game.players[recipientId].hand.push(...stolen);
    game.discard.push(card);
    publicEvent(game, 'ROBBERY_APPLIED', `${game.players[sourceId].name} entrego toda su mano a ${game.players[recipientId].name}.`, { playerId, sourceId, recipientId, cardCount: stolen.length }, at);
  } else if (card.key === 'SCAPEGOAT') {
    const [sourceId, recipientId] = orderedTargetIds;
    const source = game.players[sourceId];
    const recipient = game.players[recipientId];
    recipient.accusations.push(...source.accusations);
    recipient.blueCards.push(...source.blueCards);
    recipient.trapCards.push(...source.trapCards);
    source.accusations = [];
    source.blueCards = [];
    source.trapCards = [];
    source.accusationTotal = 0;
    recipient.accusationTotal = recipient.accusations.reduce((total, accusation) => total + (accusation.points || 0), 0);
    game.discard.push(card);
    syncSpecialCards(game);
    recalculateMarriages(game, at, true);
    publicEvent(game, 'SCAPEGOAT_APPLIED', `Todas las cartas frente a ${source.name} fueron movidas frente a ${recipient.name}.`, { playerId, sourceId, recipientId }, at);
    if (recipient.accusationTotal >= ACCUSATION_THRESHOLD && recipient.tryalCards.some((tryal) => !tryal.revealed)) {
      game.subPhase = SUB_PHASE.TRYAL_SELECTION;
      game.pendingActions = { accusedId: recipientId, accuserId: playerId };
      setDecisionTimer(game, at);
    }
  } else if (card.key === 'STOCKS') {
    game.players[targetId].trapCards.push(card);
    publicEvent(game, 'STOCKS_APPLIED', `${game.players[targetId].name} perdera su siguiente turno por un Cepo.`, { playerId, targetId }, at);
  } else if (card.key === 'MATCHMAKER') {
    game.players[targetId].blueCards.push(card);
    publicEvent(game, EVENT.MARRIAGE_CARD_ASSIGNED, `${game.players[playerId].name} asigno una carta de Casamentero a ${game.players[targetId].name}.`, { playerId, targetId, cardId: card.id }, at);
    recalculateMarriages(game, at, true);
  } else if (card.color === CARD_COLOR.BLUE) {
    game.players[targetId].blueCards.push(card);
    syncSpecialCards(game);
  } else {
    game.discard.push(card);
  }
}

function revealTryal(game, playerId, payload, rng, at) {
  const { accusedId, accuserId } = game.pendingActions;
  const resumeAfter = game.pendingActions.resumeAfter;
  assertRule(playerId === accuserId, 'NOT_ALLOWED', 'Solo quien provoco el juicio puede elegir.');
  assertRule(payload.targetId === accusedId, 'INVALID_TARGET', 'El acusado no coincide.');
  const card = game.players[accusedId].tryalCards.find((item) => item.id === payload.tryalCardId && !item.revealed);
  assertRule(card, 'INVALID_TRYAL', 'La carta de juicio no es valida.');
  card.revealed = true;
  game.discard.push(...game.players[accusedId].accusations);
  game.players[accusedId].accusations = [];
  game.players[accusedId].accusationTotal = 0;
  publicEvent(game, EVENT.TRYAL_REVEALED, `${game.players[accusedId].name} revelo una carta de Juicio: ${tryalName(card.type)}. Sus acusaciones volvieron a 0.`, { accusedId, type: card.type }, at);
  if (card.type === TRYAL.WITCH) killPlayer(game, accusedId, 'REVEALED_WITCH', at);
  else if (game.players[accusedId].tryalCards.every((item) => item.revealed)) killPlayer(game, accusedId, 'ALL_TRYALS_REVEALED', at);
  recalculateRoles(game, at);
  checkVictory(game, at);
  if (game.status !== GAME_STATUS.FINISHED && game.subPhase !== SUB_PHASE.LAST_WORDS) {
    if (resumeAfter === 'BLACK_CAT') beginDay(game, at);
    else if (resumeAfter === 'CONSPIRACY_START') beginConspiracy(game, at);
    else if (resumeAfter === 'CONSPIRACY') continueAfterConspiracy(game, rng, at);
    else {
      game.subPhase = SUB_PHASE.PLAY_CARDS;
      game.pendingActions = {};
    }
  }
}

function eliminatePlayer(game, playerId, reason) {
  const player = game.players[playerId];
  if (!player?.alive) return false;
  player.alive = false;
  player.deathReason = reason;
  player.wasWitchAnnounced = player.hasEverBeenWitch || player.tryalCards.some((card) => card.type === TRYAL.WITCH);
  player.tryalCards.forEach((card) => { card.revealed = true; });
  const releasedCards = [...player.hand, ...player.blueCards, ...player.trapCards, ...player.accusations, ...player.matchmakerCards];
  game.discard.push(...releasedCards);
  player.hand = [];
  player.blueCards = [];
  player.trapCards = [];
  player.accusations = [];
  player.accusationTotal = 0;
  player.matchmakerCards = [];
  player.hasBlackCat = false;
  game.effects = game.effects.filter((effect) => effect.sourceId !== playerId && effect.targetId !== playerId && !effect.targetIds?.includes(playerId));
  return true;
}

function announceDeath(game, playerId, reason, at) {
  const player = game.players[playerId];
  const witchAnnouncement = player.wasWitchAnnounced ? 'Si fue Bruja en algun momento de la partida.' : 'Nunca fue Bruja durante la partida.';
  publicEvent(game, EVENT.PLAYER_DIED, `${player.name} murio. ${witchAnnouncement}`, { playerId, reason, wasEverWitch: player.wasWitchAnnounced }, at);
}

function killPlayer(game, playerId, reason, at) {
  const player = game.players[playerId];
  if (!player?.alive) return false;
  const resumeActions = clone(game.pendingActions);
  const linkedId = player.marriedTo;
  eliminatePlayer(game, playerId, reason);
  player.canCommunicate = true;
  announceDeath(game, playerId, reason, at);
  if (linkedId && game.players[linkedId]?.alive) {
    eliminatePlayer(game, linkedId, 'MARRIAGE_BOND');
    game.players[linkedId].canCommunicate = false;
    announceDeath(game, linkedId, 'MARRIAGE_BOND', at);
    publicEvent(game, 'MARRIAGE_DEATH', `${game.players[linkedId].name} murio inmediatamente por su vinculo con ${player.name}.`, { playerId: linkedId, linkedPlayerId: playerId }, at);
  }
  syncSpecialCards(game);
  recalculateMarriages(game, at);
  game.subPhase = SUB_PHASE.LAST_WORDS;
  game.pendingActions = { deceasedId: playerId, resumePhase: game.phase, resumeActions };
  setDecisionTimer(game, at, 20_000);
  recalculateRoles(game, at);
  checkVictory(game, at);
  return true;
}

function finishLastWords(game, playerId, rng, at) {
  const deceasedId = game.pendingActions.deceasedId;
  const resumeActions = game.pendingActions.resumeActions || {};
  assertRule(playerId === deceasedId || game.players[playerId]?.isHost, 'NOT_ALLOWED', 'No puedes cerrar las ultimas palabras.');
  game.players[deceasedId].canCommunicate = false;
  if (game.status === GAME_STATUS.FINISHED) {
    game.subPhase = null;
    game.pendingActions = {};
    game.timers.phaseEndsAt = null;
    return;
  }
  if (resumeActions.resumeAfter === 'CONSPIRACY_START') beginConspiracy(game, at);
  else if (resumeActions.resumeAfter === 'CONSPIRACY') continueAfterConspiracy(game, rng, at);
  else if (game.pendingActions.resumePhase === GAME_STATUS.NIGHT) {
    game.pendingActions = resumeActions;
    game.pendingActions.witchVotes ||= {};
    game.pendingActions.confessions ||= {};
    game.pendingActions.confessionResponses ||= {};
    resolveNight(game, rng, at);
  }
  else if (game.pendingActions.resumePhase === GAME_STATUS.DAWN) beginDay(game, at);
  else if (game.phase === GAME_STATUS.DAY && !game.players[game.currentPlayerId]?.alive) {
    game.pendingActions = {};
    endTurn(game, at);
  } else { game.subPhase = SUB_PHASE.PLAY_CARDS; game.pendingActions = {}; }
}

function submitLastWords(game, playerId, message, rng, at) {
  const text = String(message || '').trim().replace(/\s+/g, ' ').slice(0, 160);
  assertRule(text.length > 0, 'EMPTY_LAST_WORDS', 'Escribe tus ultimas palabras.');
  assertRule(game.subPhase === SUB_PHASE.LAST_WORDS && game.pendingActions.deceasedId === playerId, 'NOT_ALLOWED', 'No puedes enviar ultimas palabras.');
  publicEvent(game, 'LAST_WORDS', `${game.players[playerId].name}: “${text}”`, { playerId }, at);
  finishLastWords(game, playerId, rng, at);
}

function conspiracySourceId(game, playerId) {
  const alive = game.turnOrder.filter((id) => game.players[id].alive);
  const playerIndex = alive.indexOf(playerId);
  return playerIndex < 0 ? null : alive[(playerIndex - 1 + alive.length) % alive.length];
}

function continueAfterConspiracy(game, rng, at) {
  game.pendingActions = {};
  if (game.interruptedTurn) resumeInterruptedDraw(game, rng, at);
  else {
    game.subPhase = SUB_PHASE.WAITING_ACTION;
    endTurn(game, at);
  }
}

function chooseConspiracyCard(game, playerId, payload, rng, at) {
  assertRule(game.players[playerId].alive, 'PLAYER_DEAD', 'Los muertos no participan.');
  assertRule(!game.pendingActions.conspiracySelections[playerId], 'ALREADY_SELECTED', 'Ya elegiste una carta para esta Conspiracion.');
  const fromId = conspiracySourceId(game, playerId);
  const hiddenCards = game.players[fromId].tryalCards.filter((item) => !item.revealed);
  const choiceIndex = Number(payload?.tryalCardIndex);
  const card = Number.isInteger(choiceIndex) ? hiddenCards[choiceIndex] : null;
  assertRule(card, 'INVALID_TRYAL', 'Debes elegir una carta oculta del jugador a tu izquierda.');
  game.pendingActions.conspiracySelections[playerId] = { fromId, cardId: card.id };
  const alive = game.turnOrder.filter((id) => game.players[id].alive);
  if (!alive.every((id) => game.pendingActions.conspiracySelections[id])) return;
  const transfers = alive.map((toId) => ({ toId, ...game.pendingActions.conspiracySelections[toId] }));
  const cards = transfers.map(({ fromId, cardId: selected }) => {
    const index = game.players[fromId].tryalCards.findIndex((item) => item.id === selected);
    return game.players[fromId].tryalCards.splice(index, 1)[0];
  });
  transfers.forEach((transfer, index) => {
    const cardReceived = cards[index];
    game.players[transfer.toId].tryalCards.push(cardReceived);
    game.players[transfer.toId].lastConspiracyCard = { fromId: transfer.fromId, fromName: game.players[transfer.fromId].name, type: cardReceived.type };
    game.players[transfer.toId].secretInformation.push({ type: EVENT.TRYAL_TRANSFERRED, message: `Tomaste una carta oculta de ${game.players[transfer.fromId].name}: ${tryalName(cardReceived.type)}.` });
    publicEvent(game, EVENT.TRYAL_TRANSFERRED, `${game.players[transfer.toId].name} tomo una carta de Juicio oculta de ${game.players[transfer.fromId].name}.`, { fromId: transfer.fromId, toId: transfer.toId }, at);
  });
  recalculateRoles(game, at);
  checkVictory(game, at);
  if (game.status !== GAME_STATUS.FINISHED) continueAfterConspiracy(game, rng, at);
}

function nextAliveIndex(game) {
  for (let offset = 1; offset <= game.turnOrder.length; offset += 1) {
    const index = (game.turn.index + offset) % game.turnOrder.length;
    if (game.players[game.turnOrder[index]].alive) return index;
  }
  return game.turn.index;
}

function endTurn(game, at) {
  const previousId = game.currentPlayerId;
  publicEvent(game, EVENT.TURN_ENDED, `Termino el turno de ${game.players[previousId].name}.`, { playerId: previousId }, at);
  let previousIndex = game.turn.index;
  while (true) {
    game.turn.index = nextAliveIndex(game);
    if (game.turn.index <= previousIndex) game.round += 1;
    game.turn.number += 1;
    game.currentPlayerId = game.turnOrder[game.turn.index];
    const nextPlayer = game.players[game.currentPlayerId];
    if (!nextPlayer.trapCards.length) break;
    const [stocks] = nextPlayer.trapCards.splice(0, 1);
    game.discard.push(stocks);
    publicEvent(game, 'TURN_SKIPPED', `${nextPlayer.name} perdio su turno por un Cepo, que fue descartado.`, { playerId: nextPlayer.id, cardId: stocks.id }, at);
    previousIndex = game.turn.index;
  }
  game.turn.mode = null;
  game.subPhase = SUB_PHASE.WAITING_ACTION;
  setDecisionTimer(game, at);
  publicEvent(game, EVENT.TURN_STARTED, `Comenzo el turno de ${game.players[game.currentPlayerId].name}.`, { playerId: game.currentPlayerId }, at);
}

function beginConstableSelection(game, at) {
  game.subPhase = SUB_PHASE.CONSTABLE_SELECTION;
  setDecisionTimer(game, at);
  const constable = game.turnOrder.find((id) => game.players[id].alive && game.players[id].isCurrentConstable);
  if (!constable) beginConfession(game, at);
}

function beginConfession(game, at) {
  game.subPhase = SUB_PHASE.CONFESSION;
  game.pendingActions.confessionResponses = {};
  setDecisionTimer(game, at);
}

function allLivingResponded(game, responses) {
  return game.turnOrder.filter((id) => game.players[id].alive).every((id) => Object.hasOwn(responses, id));
}

function selectWitchVictim(game, playerId, targetId, at) {
  assertRule(game.players[playerId].alive && game.players[playerId].hasEverBeenWitch, 'NOT_ALLOWED', 'No participas en esta seleccion.');
  assertRule(game.players[targetId]?.alive && !game.players[targetId].hasEverBeenWitch, 'INVALID_TARGET', 'La victima no es valida.');
  game.pendingActions.witchVotes[playerId] = targetId;
  const eligible = game.turnOrder.filter((id) => game.players[id].alive && game.players[id].hasEverBeenWitch);
  if (eligible.every((id) => game.pendingActions.witchVotes[id])) beginConstableSelection(game, at);
}

function selectProtection(game, playerId, targetId, at) {
  assertRule(game.players[playerId].alive && game.players[playerId].isCurrentConstable, 'NOT_ALLOWED', 'No eres el Alguacil actual.');
  assertRule(game.players[targetId]?.alive && targetId !== playerId, 'INVALID_TARGET', 'No puedes proteger a ese jugador.');
  game.pendingActions.protection = targetId;
  game.players[targetId].protectedTonight = true;
  game.players[playerId].secretInformation.push({ type: EVENT.PLAYER_PROTECTED, message: `Protegiste a ${game.players[targetId].name} esta noche.` });
  beginConfession(game, at);
}

function confess(game, playerId, tryalCardId, rng, at) {
  const card = game.players[playerId].tryalCards.find((item) => item.id === tryalCardId && !item.revealed);
  assertRule(game.players[playerId].alive && card, 'INVALID_TRYAL', 'No puedes confesar esa carta.');
  card.revealed = true;
  game.players[playerId].confessedTonight = true;
  game.pendingActions.confessions[playerId] = tryalCardId;
  game.pendingActions.confessionResponses[playerId] = 'CONFESSED';
  publicEvent(game, EVENT.PLAYER_CONFESSED, `${game.players[playerId].name} confeso y revelo ${tryalName(card.type)}.`, { playerId, type: card.type }, at);
  if (card.type === TRYAL.WITCH) killPlayer(game, playerId, 'CONFESSED_WITCH', at);
  else if (game.players[playerId].tryalCards.every((item) => item.revealed)) killPlayer(game, playerId, 'ALL_TRYALS_REVEALED', at);
  recalculateRoles(game, at);
  checkVictory(game, at);
  if (game.status !== GAME_STATUS.FINISHED && game.subPhase !== SUB_PHASE.LAST_WORDS && allLivingResponded(game, game.pendingActions.confessionResponses)) resolveNight(game, rng, at);
}

function passConfession(game, playerId, rng, at) {
  assertRule(game.phase === GAME_STATUS.NIGHT && game.subPhase === SUB_PHASE.CONFESSION, 'WRONG_PHASE', 'No es momento de responder a la confesion.');
  assertRule(game.players[playerId].alive, 'PLAYER_DEAD', 'Los muertos no participan.');
  game.pendingActions.confessionResponses[playerId] = 'PASSED';
  if (allLivingResponded(game, game.pendingActions.confessionResponses)) resolveNight(game, rng, at);
}

function resolveNight(game, rng, at) {
  game.subPhase = SUB_PHASE.NIGHT_RESOLUTION;
  const votes = Object.values(game.pendingActions.witchVotes || {});
  const counts = votes.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {});
  const victimId = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  const victim = game.players[victimId];
  if (victim && !victim.protectedTonight && !victim.confessedTonight && !hasAsylum(victim)) {
    if (killPlayer(game, victimId, 'WITCH_ATTACK', at)) return;
  }
  cleanupNight(game, rng, at);
}

function cleanupNight(game, rng, at) {
  game.turnOrder.forEach((id) => {
    game.players[id].protectedTonight = false;
    game.players[id].confessedTonight = false;
    const expired = game.players[id].blueCards.filter((card) => card.duration === 'UNTIL_END_OF_NIGHT');
    game.discard.push(...expired);
    game.players[id].blueCards = game.players[id].blueCards.filter((card) => card.duration !== 'UNTIL_END_OF_NIGHT');
  });
  game.pendingActions = {};
  recycleDiscard(game, rng);
  publicEvent(game, EVENT.NIGHT_ENDED, 'Termino la noche.', {}, at);
  checkVictory(game, at);
  if (game.status !== GAME_STATUS.FINISHED) {
    if (game.interruptedTurn) resumeInterruptedDraw(game, rng, at);
    else beginDay(game, at);
  }
}

function checkVictory(game, at = Date.now()) {
  if (game.status === GAME_STATUS.FINISHED) return game.winner;
  const witchesRemaining = game.turnOrder.some((id) => game.players[id].tryalCards.some((card) => card.type === TRYAL.WITCH && !card.revealed));
  const alive = game.turnOrder.filter((id) => game.players[id].alive);
  let winner = null;
  if (!witchesRemaining) winner = 'TOWN';
  else if (alive.length && alive.every((id) => game.players[id].hasEverBeenWitch)) winner = 'WITCHES';
  if (winner) {
    game.winner = winner;
    game.status = GAME_STATUS.FINISHED;
    game.phase = GAME_STATUS.FINISHED;
    if (game.subPhase !== SUB_PHASE.LAST_WORDS) {
      game.subPhase = null;
      game.timers.phaseEndsAt = null;
    }
    publicEvent(game, EVENT.GAME_FINISHED, `La partida termino. Ganador: ${winner}.`, { winner }, at);
  }
  return winner;
}

function validateCommon(game, playerId, action) {
  assertRule(game.players[playerId], 'NOT_IN_GAME', 'No perteneces a la partida.');
  const allowedWhenDead = [ACTION.SUBMIT_LAST_WORDS, ACTION.END_LAST_WORDS, ACTION.APPLY_TIMEOUT, ACTION.RESET_GAME];
  assertRule(game.status !== GAME_STATUS.FINISHED || allowedWhenDead.includes(action.type), 'GAME_FINISHED', 'La partida ya termino.');
  assertRule(game.players[playerId].alive || allowedWhenDead.includes(action.type), 'PLAYER_DEAD', 'Los jugadores muertos solo pueden observar.');
  const turnActions = [ACTION.DRAW_CARDS, ACTION.PLAY_CARD, ACTION.END_TURN];
  if (turnActions.includes(action.type)) {
    assertRule(game.phase === GAME_STATUS.DAY && game.currentPlayerId === playerId, 'NOT_YOUR_TURN', 'No es tu turno.');
    assertRule([SUB_PHASE.WAITING_ACTION, SUB_PHASE.PLAY_CARDS].includes(game.subPhase), 'PENDING_RESOLUTION', 'Hay una resolucion pendiente.');
  }
}

function applyTimeout(game, playerId, rng, at) {
  assertRule(game.players[playerId], 'NOT_IN_GAME', 'No perteneces a la partida.');
  assertRule(game.timers.phaseEndsAt && at >= game.timers.phaseEndsAt, 'TOO_EARLY', 'La ventana de reconexion sigue abierta.');
  if (game.phase === GAME_STATUS.DAWN && game.subPhase === 'BLACK_CAT_SELECTION') {
    const witchId = game.turnOrder.find((id) => game.players[id].alive && game.players[id].isCurrentWitch);
    const targetId = game.turnOrder.find((id) => game.players[id].alive);
    selectBlackCat(game, witchId, targetId, at);
  }
  else if (game.subPhase === SUB_PHASE.LAST_WORDS) finishLastWords(game, playerId, rng, at);
  else if (game.subPhase === SUB_PHASE.WITCH_SELECTION) {
    const targets = game.turnOrder.filter((id) => game.players[id].alive && !game.players[id].hasEverBeenWitch);
    game.turnOrder.filter((id) => game.players[id].alive && game.players[id].hasEverBeenWitch && !game.pendingActions.witchVotes[id])
      .forEach((id) => { if (targets.length) game.pendingActions.witchVotes[id] = targets[0]; });
    beginConstableSelection(game, at);
  } else if (game.subPhase === SUB_PHASE.CONSTABLE_SELECTION) beginConfession(game, at);
  else if (game.subPhase === SUB_PHASE.CONFESSION) {
    game.turnOrder.filter((id) => game.players[id].alive && !Object.hasOwn(game.pendingActions.confessionResponses, id))
      .forEach((id) => { game.pendingActions.confessionResponses[id] = 'PASSED'; });
    resolveNight(game, rng, at);
  }
  else if (game.subPhase === SUB_PHASE.TRYAL_SELECTION) {
    const accusedId = game.pendingActions.accusedId;
    const card = game.players[accusedId].tryalCards.find((item) => !item.revealed);
    revealTryal(game, game.pendingActions.accuserId, { targetId: accusedId, tryalCardId: card.id }, rng, at);
  } else if (game.subPhase === SUB_PHASE.CONSPIRACY_RESOLUTION) {
    const alive = game.turnOrder.filter((id) => game.players[id].alive);
    alive.filter((id) => !game.pendingActions.conspiracySelections[id]).forEach((id) => {
      chooseConspiracyCard(game, id, { tryalCardIndex: 0 }, rng, at);
    });
  }
  else if (game.phase === GAME_STATUS.DAY) endTurn(game, at);
}

export function executeAction(gameInput, playerId, action, options = {}) {
  const at = options.now ?? Date.now();
  const rng = options.rng ?? Math.random;
  assertRule(action?.actionId && action?.type, 'INVALID_ACTION', 'La accion requiere actionId y type.');
  const game = hydrateGameState(gameInput);
  if (game.processedActionIds[action.actionId]) return game;
  assertRule(action.expectedVersion === game.version, 'VERSION_CONFLICT', 'El estado de la partida cambio. Actualiza e intenta de nuevo.');
  validateCommon(game, playerId, action);
  const previousStateHash = stateHash(game);
  switch (action.type) {
    case ACTION.START_GAME: startGame(game, playerId, rng, at); break;
    case ACTION.RESET_GAME: resetGame(game, playerId, at); break;
    case ACTION.SELECT_BLACK_CAT: selectBlackCat(game, playerId, action.payload?.targetId, at); break;
    case ACTION.DRAW_CARDS: drawCards(game, playerId, rng, at); break;
    case ACTION.PLAY_CARD: playCard(game, playerId, action.payload || {}, at); break;
    case ACTION.END_TURN: endTurn(game, at); break;
    case ACTION.SELECT_TRYAL: revealTryal(game, playerId, action.payload || {}, rng, at); break;
    case ACTION.SELECT_CONSPIRACY_CARD: chooseConspiracyCard(game, playerId, action.payload || {}, rng, at); break;
    case ACTION.SELECT_WITCH_VICTIM: selectWitchVictim(game, playerId, action.payload?.targetId, at); break;
    case ACTION.SELECT_CONSTABLE_PROTECTION: selectProtection(game, playerId, action.payload?.targetId, at); break;
    case ACTION.CONFESS: confess(game, playerId, action.payload?.tryalCardId, rng, at); break;
    case ACTION.PASS_CONFESSION: passConfession(game, playerId, rng, at); break;
    case ACTION.SUBMIT_LAST_WORDS: submitLastWords(game, playerId, action.payload?.message, rng, at); break;
    case ACTION.END_LAST_WORDS: finishLastWords(game, playerId, rng, at); break;
    case ACTION.APPLY_TIMEOUT: applyTimeout(game, playerId, rng, at); break;
    default: throw new GameRuleError('UNKNOWN_ACTION', 'Tipo de accion desconocido.');
  }
  game.version += 1;
  game.updatedAt = nowIso(at);
  game.processedActionIds[action.actionId] = { playerId, version: game.version, at: nowIso(at) };
  const resultStateHash = stateHash(game);
  game.internalLog.push({ eventId: action.actionId, timestamp: nowIso(at), gameVersion: game.version, playerId, action: action.type, payload: action.payload || {}, previousStateHash, resultStateHash });
  return game;
}

function publicPlayer(player) {
  return {
    id: player.id, name: player.name, alive: player.alive, connected: player.connected, isHost: player.isHost,
    character: player.character, tryalCardCount: player.tryalCards.filter((card) => !card.revealed).length,
    revealedTryalCards: player.tryalCards.filter((card) => card.revealed).map(({ id, type, revealed }) => ({ id, type, revealed })),
    blueCards: player.blueCards, accusations: player.accusations, accusationTotal: player.accusationTotal,
    hasBlackCat: player.hasBlackCat, canCommunicate: player.canCommunicate, deathReason: player.deathReason,
    trapCardCount: player.trapCards.length,
    matchmakerCardCount: player.blueCards.filter((card) => card.key === 'MATCHMAKER').length, marriedTo: player.marriedTo,
    wasEverWitch: player.alive ? undefined : player.wasWitchAnnounced,
  };
}

export function buildPlayerView(game, playerId) {
  game = hydrateGameState(game);
  const viewer = game.players[playerId];
  assertRule(viewer, 'NOT_IN_GAME', 'No perteneces a la partida.');
  const publicState = {
    id: game.id, inviteCode: game.inviteCode, status: game.status, phase: game.phase, subPhase: game.subPhase,
    round: game.round, turn: game.turn, currentPlayerId: game.currentPlayerId, version: game.version,
    deckCount: game.deck.length, discard: game.discard, players: Object.fromEntries(game.turnOrder.map((id) => [id, publicPlayer(game.players[id])])),
    turnOrder: game.turnOrder, effects: game.effects.filter((effect) => effect.visibility === 'PUBLIC'),
    pendingAction: buildPublicPendingAction(game), timers: game.timers, history: game.history, winner: game.winner,
  };
  const legalActions = legalActionsFor(game, playerId);
  if (game.timers.phaseEndsAt && (game.status !== GAME_STATUS.FINISHED || game.subPhase === SUB_PHASE.LAST_WORDS)) {
    legalActions.push({ type: ACTION.APPLY_TIMEOUT, phaseEndsAt: game.timers.phaseEndsAt });
  }
  const privateState = {
    playerId, hand: viewer.hand, tryalCards: viewer.tryalCards, secretInformation: viewer.secretInformation,
    hasEverBeenWitch: viewer.hasEverBeenWitch, isCurrentWitch: viewer.isCurrentWitch,
    isCurrentConstable: viewer.isCurrentConstable, confessedTonight: viewer.confessedTonight,
    lastConspiracyCard: viewer.lastConspiracyCard, legalActions,
  };
  if (viewer.alive && viewer.hasEverBeenWitch && game.phase === GAME_STATUS.DAWN) {
    privateState.knownWitches = game.turnOrder
      .filter((id) => id !== playerId && game.players[id].hasEverBeenWitch && game.players[id].alive)
      .map((id) => ({ id, name: game.players[id].name }));
  }
  return { publicState, privateState };
}

function buildPublicPendingAction(game) {
  if (game.subPhase === SUB_PHASE.TRYAL_SELECTION) return {
    accusedId: game.pendingActions.accusedId,
    accuserId: game.pendingActions.accuserId,
    reason: ['CONSPIRACY', 'CONSPIRACY_START'].includes(game.pendingActions.resumeAfter) ? 'BLACK_CAT' : game.pendingActions.resumeAfter || 'ACCUSATION',
  };
  if (game.subPhase === SUB_PHASE.LAST_WORDS) return { deceasedId: game.pendingActions.deceasedId };
  return null;
}

function legalActionsFor(game, playerId) {
  const player = game.players[playerId];
  if (game.status === GAME_STATUS.FINISHED && game.subPhase !== SUB_PHASE.LAST_WORDS) return player.isHost ? [{ type: ACTION.RESET_GAME }] : [];
  if (!player.alive) return game.subPhase === SUB_PHASE.LAST_WORDS && game.pendingActions.deceasedId === playerId ? [{ type: ACTION.SUBMIT_LAST_WORDS }, { type: ACTION.END_LAST_WORDS }] : [];
  if (game.phase === GAME_STATUS.LOBBY && player.isHost) return [{ type: ACTION.START_GAME }];
  if (game.phase === GAME_STATUS.DAWN && game.subPhase === 'BLACK_CAT_SELECTION' && player.alive && player.isCurrentWitch) {
    return [{ type: ACTION.SELECT_BLACK_CAT, targets: game.turnOrder.filter((id) => game.players[id].alive) }];
  }
  if (game.subPhase === SUB_PHASE.TRYAL_SELECTION && game.pendingActions.accuserId === playerId) {
    const accused = game.players[game.pendingActions.accusedId];
    return [{ type: ACTION.SELECT_TRYAL, targetId: accused.id, tryalOptions: accused.tryalCards.filter((card) => !card.revealed).map((card) => card.id) }];
  }
  if (game.subPhase === SUB_PHASE.CONSPIRACY_RESOLUTION) {
    if (game.pendingActions.conspiracySelections[playerId]) return [];
    const sourceId = conspiracySourceId(game, playerId);
    const hiddenCount = game.players[sourceId]?.tryalCards.filter((card) => !card.revealed).length || 0;
    return [{
      type: ACTION.SELECT_CONSPIRACY_CARD,
      sourceId,
      sourceName: game.players[sourceId]?.name,
      tryalOptions: Array.from({ length: hiddenCount }, (_, index) => index),
    }];
  }
  if (game.phase === GAME_STATUS.DAY && game.currentPlayerId === playerId) {
    if ([SUB_PHASE.WAITING_ACTION, SUB_PHASE.PLAY_CARDS].includes(game.subPhase)) {
      return [
        ...(game.turn.mode ? [] : [{ type: ACTION.DRAW_CARDS }]),
        ...game.players[playerId].hand.filter((card) => card.trigger === 'ON_PLAY').flatMap((card) => {
          const targets = validTargets(game, playerId, card);
          const targetCount = card.targetCount || (card.targetRules === 'NONE' ? 0 : 1);
          if (targets.length < targetCount) return [];
          const option = { type: ACTION.PLAY_CARD, cardId: card.id, targets, targetCount };
          if (card.key === 'ALIBI') option.accusationOptions = Object.fromEntries(targets.map((id) => [id, game.players[id].accusations
            .filter((accusation) => (accusation.points || 0) <= 3)
            .map((accusation) => ({ id: accusation.id || accusation.cardId, name: accusation.name || 'Acusacion', points: accusation.points || 0 }))]));
          if (card.key === 'CURSE') option.blueCardOptions = Object.fromEntries(targets.map((id) => [id, game.players[id].blueCards
            .map((blueCard) => ({ id: blueCard.id, name: blueCard.name }))]));
          if (card.key === 'SCAPEGOAT') option.sourceTargets = targets.filter((id) => frontCardCount(game.players[id]) > 0);
          if (card.key === 'SCAPEGOAT' && option.sourceTargets.length === 0) return [];
          if (['ROBBERY', 'SCAPEGOAT'].includes(card.key)) option.orderedTargets = true;
          return [option];
        }),
        ...(game.turn.mode === 'PLAY' ? [{ type: ACTION.END_TURN }] : []),
      ];
    }
  }
  if (game.phase === GAME_STATUS.NIGHT) {
    if (game.subPhase === SUB_PHASE.WITCH_SELECTION && player.hasEverBeenWitch && !game.pendingActions.witchVotes[playerId]) return [{ type: ACTION.SELECT_WITCH_VICTIM, targets: game.turnOrder.filter((id) => game.players[id].alive && !game.players[id].hasEverBeenWitch) }];
    if (game.subPhase === SUB_PHASE.CONSTABLE_SELECTION && player.isCurrentConstable && !game.pendingActions.protection) return [{ type: ACTION.SELECT_CONSTABLE_PROTECTION, targets: game.turnOrder.filter((id) => game.players[id].alive && id !== playerId) }];
    if (game.subPhase === SUB_PHASE.CONFESSION && !Object.hasOwn(game.pendingActions.confessionResponses, playerId)) return [{ type: ACTION.CONFESS }, { type: ACTION.PASS_CONFESSION }];
  }
  return [];
}

export const GameEngine = Object.freeze({ createGame, addPlayer, executeAction, buildPlayerView });
