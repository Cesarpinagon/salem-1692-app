import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION, GAME_STATUS, SUB_PHASE, TRYAL } from '../src/game/constants.js';
import { GameEngine, GameRuleError, hydrateGameState } from '../src/game/engine.js';
import { buildTownDeck } from '../src/game/cards.js';

const rng = () => 0.314159;

function lobby() {
  let game = GameEngine.createGame({ id: 'SALEM', inviteCode: 'SALEM', host: { id: 'p1', firebaseUid: 'u1', name: 'Host' }, now: 1 });
  for (let n = 2; n <= 4; n += 1) game = GameEngine.addPlayer(game, { id: `p${n}`, firebaseUid: `u${n}`, name: `Player ${n}` }, n);
  return game;
}

function act(game, playerId, type, payload = {}, suffix = '') {
  return GameEngine.executeAction(game, playerId, { actionId: `${type}_${game.version}_${suffix}`, expectedVersion: game.version, type, payload }, { rng, now: 1000 + game.version });
}

function started() {
  return act(lobby(), 'p1', ACTION.START_GAME);
}

function beginDay(game) {
  const selector = game.turnOrder.find((id) => game.players[id].isCurrentWitch) || 'p1';
  const target = game.turnOrder.find((id) => id !== selector && game.players[id].tryalCards.some((card) => card.type === TRYAL.NOT_WITCH && !card.revealed));
  return act(game, selector, ACTION.SELECT_BLACK_CAT, { targetId: target });
}

function revealBlackCatAfterConspiracy(game, suffix = '') {
  assert.equal(game.subPhase, SUB_PHASE.TRYAL_SELECTION);
  assert.equal(game.pendingActions.resumeAfter, 'CONSPIRACY');
  const target = game.pendingActions.accusedId;
  const card = game.players[target].tryalCards.find((item) => item.type === TRYAL.NOT_WITCH && !item.revealed)
    || game.players[target].tryalCards.find((item) => !item.revealed);
  return act(game, target, ACTION.SELECT_TRYAL, { targetId: target, tryalCardId: card.id }, suffix);
}

test('solo el host puede iniciar y se exige una cantidad valida', () => {
  assert.throws(() => act(lobby(), 'p2', ACTION.START_GAME), (error) => error instanceof GameRuleError && error.code === 'HOST_ONLY');
  let short = GameEngine.createGame({ id: 'X', inviteCode: 'XXXX', host: { id: 'p1', firebaseUid: 'u1', name: 'Host' } });
  assert.throws(() => act(short, 'p1', ACTION.START_GAME), (error) => error.code === 'INVALID_PLAYER_COUNT');
});

test('solo el host puede reiniciar una partida terminada y el estado vuelve limpio al lobby', () => {
  const finished = started();
  finished.status = GAME_STATUS.FINISHED;
  finished.phase = GAME_STATUS.FINISHED;
  finished.subPhase = null;
  finished.winner = 'TOWN';
  finished.players.p1.alive = false;
  finished.players.p2.alive = false;
  finished.players.p2.connected = false;
  finished.players.p1.accusations = [{ amount: 7 }];
  const previousVersion = finished.version;
  const originalInviteCode = finished.inviteCode;

  assert.throws(() => act(finished, 'p2', ACTION.RESET_GAME), (error) => error.code === 'HOST_ONLY');

  const reset = act(finished, 'p1', ACTION.RESET_GAME);
  assert.equal(reset.status, GAME_STATUS.LOBBY);
  assert.equal(reset.phase, GAME_STATUS.LOBBY);
  assert.equal(reset.winner, null);
  assert.equal(reset.inviteCode, originalInviteCode);
  assert.equal(reset.version, previousVersion + 1);
  assert.deepEqual(reset.deck, []);
  assert.deepEqual(reset.history, []);
  assert.deepEqual(reset.players.p1.hand, []);
  assert.deepEqual(reset.players.p1.tryalCards, []);
  assert.deepEqual(reset.players.p1.accusations, []);
  assert.equal(reset.players.p1.alive, true);
  assert.equal(reset.players.p2.alive, true);
  assert.equal(reset.players.p2.connected, false);
  assert.equal(reset.players.p1.isHost, true);
  assert.deepEqual(GameEngine.buildPlayerView(reset, 'p1').privateState.legalActions, [{ type: ACTION.START_GAME }]);
});

test('rehidrata arreglos vacios omitidos por Realtime Database al unir jugadores', () => {
  let game = GameEngine.createGame({ id: 'RTDB', inviteCode: 'RTDB42', host: { id: 'p1', firebaseUid: 'u1', name: 'Host' } });
  delete game.deck;
  delete game.discard;
  delete game.effects;
  delete game.history;
  delete game.players.p1.hand;
  delete game.players.p1.tryalCards;
  game = GameEngine.addPlayer(game, { id: 'p2', firebaseUid: 'u2', name: 'Player 2' });
  const view = GameEngine.buildPlayerView(game, 'p2');
  assert.equal(view.publicState.deckCount, 0);
  assert.deepEqual(view.privateState.hand, []);
  assert.equal(Object.keys(view.publicState.players).length, 2);
});

test('setup asigna roles, conserva hasEverBeenWitch y entra a Dawn', () => {
  const game = started();
  assert.equal(game.phase, GAME_STATUS.DAWN);
  assert.equal(game.turnOrder.filter((id) => game.players[id].isCurrentWitch).length, 1);
  assert.equal(game.turnOrder.filter((id) => game.players[id].isCurrentConstable).length, 1);
  const witch = game.turnOrder.find((id) => game.players[id].isCurrentWitch);
  game.players[witch].tryalCards = game.players[witch].tryalCards.filter((card) => card.type !== TRYAL.WITCH);
  game.players[witch].isCurrentWitch = false;
  assert.equal(game.players[witch].hasEverBeenWitch, true);
});

test('PlayerView nunca filtra manos ni Tryal ocultas ajenas', () => {
  const game = started();
  const view = GameEngine.buildPlayerView(game, 'p1');
  assert.ok(view.privateState.hand.length);
  assert.ok(view.privateState.tryalCards.length);
  assert.equal('protectedTonight' in view.privateState, false);
  Object.values(view.publicState.players).forEach((player) => {
    assert.equal('hand' in player, false);
    assert.equal('tryalCards' in player, false);
    assert.equal('hasEverBeenWitch' in player, false);
    assert.equal('firebaseUid' in player, false);
  });
});

test('una accion duplicada no se ejecuta dos veces y una version obsoleta se rechaza', () => {
  let game = beginDay(started());
  const action = { actionId: 'once', expectedVersion: game.version, type: ACTION.END_TURN, payload: {} };
  const once = GameEngine.executeAction(game, game.currentPlayerId, action, { now: 5000, rng });
  const twice = GameEngine.executeAction(once, game.currentPlayerId, action, { now: 5001, rng });
  assert.deepEqual(twice, once);
  assert.throws(() => GameEngine.executeAction(once, once.currentPlayerId, { ...action, actionId: 'stale' }), (error) => error.code === 'VERSION_CONFLICT');
});

test('las acusaciones suman sus puntos exactamente una vez', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  const target = game.turnOrder.find((id) => id !== actor);
  game.players[actor].hand.unshift({ id: 'evidence_exact', key: 'EVIDENCE', name: 'Evidencia', color: 'RED', points: 3, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER' });
  game = act(game, actor, ACTION.PLAY_CARD, { cardId: 'evidence_exact', targetId: target });
  assert.equal(game.players[target].accusationTotal, 3);
  assert.equal(game.players[target].accusations.length, 1);
  assert.notEqual(game.subPhase, SUB_PHASE.TRYAL_SELECTION);
});

test('solo la bruja actual puede asignar Black Cat', () => {
  const game = started();
  const nonWitch = game.turnOrder.find((id) => !game.players[id].isCurrentWitch);
  assert.throws(() => act(game, nonWitch, ACTION.SELECT_BLACK_CAT, { targetId: 'p1' }), (error) => error.code === 'NOT_ALLOWED');
});

test('el mazo alcanza para repartir cinco cartas a doce jugadores', () => {
  let game = GameEngine.createGame({ id: 'BIG', inviteCode: 'BIG012', host: { id: 'p1', firebaseUid: 'u1', name: 'Host' }, now: 1 });
  for (let n = 2; n <= 12; n += 1) game = GameEngine.addPlayer(game, { id: `p${n}`, firebaseUid: `u${n}`, name: `Player ${n}` }, n);
  game = act(game, 'p1', ACTION.START_GAME);
  assert.equal(game.turnOrder.length, 12);
  assert.ok(game.turnOrder.every((id) => game.players[id].hand.length === 5));
  assert.ok(game.deck.length >= 20);
});

test('el mazo contiene una Conspiracion, un Asilo y dos cartas de Casamiento', () => {
  for (const playerCount of [4, 8, 12]) {
    const deck = buildTownDeck(playerCount);
    assert.equal(deck.filter((card) => card.key === 'CONSPIRACY').length, 1);
    assert.equal(deck.filter((card) => card.key === 'ASYLUM').length, 1);
    assert.equal(deck.find((card) => card.key === 'ASYLUM').id, 'ASYLUM_UNIQUE');
    assert.equal(deck.filter((card) => card.key === 'MATCHMAKER').length, 2);
    assert.equal(deck.filter((card) => card.key === 'NIGHT').length, 0);
    assert.equal(new Set(deck.map((card) => card.id)).size, deck.length);
  }
});

test('una partida anterior conserva solamente un Asilo activo', () => {
  const game = beginDay(started());
  const [first, second] = game.turnOrder;
  game.players[first].blueCards.push({ id: 'asylum_active', key: 'ASYLUM', color: 'BLUE' });
  game.players[second].hand.push({ id: 'asylum_hand', key: 'ASYLUM', color: 'BLUE' });
  game.deck.push({ id: 'asylum_deck', key: 'ASYLUM', color: 'BLUE' });
  game.discard.push({ id: 'asylum_discard', key: 'ASYLUM', color: 'BLUE' });

  const hydrated = hydrateGameState(game);
  const activeAsylums = [
    ...hydrated.deck,
    ...hydrated.discard,
    ...Object.values(hydrated.players).flatMap((player) => [...player.hand, ...player.blueCards]),
  ].filter((card) => card.key === 'ASYLUM');
  assert.equal(activeAsylums.length, 1);
  assert.equal(activeAsylums[0].id, 'asylum_active');
});

test('Coartada solo se juega sobre otro jugador y retira como maximo tres acusaciones', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  const target = game.turnOrder.find((id) => id !== actor);
  game.players[actor].hand.unshift({ id: 'alibi_test', key: 'ALIBI', name: 'Coartada', color: 'GREEN', trigger: 'ON_PLAY', targetRules: 'SELF' });
  game.players[target].accusations = [
    { cardId: 'red_1', points: 1 }, { cardId: 'red_2', points: 1 },
    { cardId: 'red_3', points: 1 }, { cardId: 'red_4', points: 1 },
  ];
  game.players[target].accusationTotal = 4;

  const action = GameEngine.buildPlayerView(game, actor).privateState.legalActions.find((item) => item.cardId === 'alibi_test');
  assert.ok(action.targets.includes(target));
  assert.ok(!action.targets.includes(actor));
  assert.throws(() => act(game, actor, ACTION.PLAY_CARD, { cardId: 'alibi_test', targetId: actor }), (error) => error.code === 'INVALID_TARGET');

  game = act(game, actor, ACTION.PLAY_CARD, { cardId: 'alibi_test', targetId: target });
  assert.equal(game.players[target].accusations.length, 1);
  assert.equal(game.players[target].accusationTotal, 1);
  assert.ok(game.discard.some((card) => card.id === 'alibi_test'));
});

test('Asilo solo se coloca frente a otro jugador y permanece protegiendolo', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  const target = game.turnOrder.find((id) => id !== actor);
  game.players[actor].hand.unshift({ id: 'asylum_play', key: 'ASYLUM', name: 'Asilo / Proteccion', color: 'BLUE', trigger: 'ON_PLAY', targetRules: 'ANY_ALIVE_PLAYER', duration: 'PERMANENT' });

  const action = GameEngine.buildPlayerView(game, actor).privateState.legalActions.find((item) => item.cardId === 'asylum_play');
  assert.ok(action.targets.includes(target));
  assert.ok(!action.targets.includes(actor));
  assert.throws(() => act(game, actor, ACTION.PLAY_CARD, { cardId: 'asylum_play', targetId: actor }), (error) => error.code === 'INVALID_TARGET');

  game = act(game, actor, ACTION.PLAY_CARD, { cardId: 'asylum_play', targetId: target });
  assert.equal(game.players[target].blueCards.some((card) => card.id === 'asylum_play'), true);
  assert.equal(game.players[actor].blueCards.some((card) => card.id === 'asylum_play'), false);
});

test('Conspiracion nunca se reparte y permanece como carta unica del mazo', () => {
  for (const playerCount of [4, 8, 12]) {
    let game = GameEngine.createGame({ id: `DECK_${playerCount}`, inviteCode: `D${playerCount}TEST`, host: { id: 'p1', firebaseUid: 'u1', name: 'Host' }, now: 1 });
    for (let n = 2; n <= playerCount; n += 1) game = GameEngine.addPlayer(game, { id: `p${n}`, firebaseUid: `u${n}`, name: `Player ${n}` }, n);
    game = act(game, 'p1', ACTION.START_GAME, {}, `players_${playerCount}`);
    assert.ok(game.turnOrder.every((id) => game.players[id].hand.every((card) => card.key !== 'CONSPIRACY')));
    assert.equal(game.deck.filter((card) => card.key === 'CONSPIRACY').length, 1);
  }
});

test('una partida anterior recupera Conspiracion si habia quedado en una mano', () => {
  const game = started();
  const owner = game.turnOrder[0];
  const conspiracy = game.deck.find((card) => card.key === 'CONSPIRACY');
  game.deck = game.deck.filter((card) => card.id !== conspiracy.id);
  game.players[owner].hand.push(conspiracy);
  const previousDeckCount = game.deck.length;
  const view = GameEngine.buildPlayerView(game, owner);
  assert.ok(view.privateState.hand.every((card) => card.key !== 'CONSPIRACY'));
  assert.equal(view.publicState.deckCount, previousDeckCount + 1);
});

test('Conspiracion vuelve una sola vez al mazo al terminar la Noche', () => {
  let game = beginDay(started());
  const conspiracy = game.deck.find((card) => card.key === 'CONSPIRACY');
  game.deck = [];
  game.discard = [conspiracy];
  game.status = GAME_STATUS.NIGHT;
  game.phase = GAME_STATUS.NIGHT;
  game.subPhase = SUB_PHASE.CONFESSION;
  game.pendingActions = { witchVotes: {}, protection: null, confessions: {}, confessionResponses: {} };
  for (const id of game.turnOrder.filter((playerId) => game.players[playerId].alive)) {
    game = act(game, id, ACTION.PASS_CONFESSION, {}, `recycle_${id}`);
  }
  assert.equal(game.deck.filter((card) => card.key === 'CONSPIRACY').length, 1);
  assert.equal(game.discard.filter((card) => card.key === 'CONSPIRACY').length, 0);
});

test('la Noche no comienza mientras queden cartas en el mazo principal', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  game.deck = [
    { id: 'legacy_night', key: 'NIGHT', name: 'Noche', color: 'BLACK', trigger: 'ON_DRAW', targetRules: 'NONE' },
    { id: 'normal_draw', key: 'ALIBI', name: 'Coartada', color: 'GREEN', trigger: 'ON_PLAY', targetRules: 'SELF' },
    { id: 'still_in_deck', key: 'ALIBI', name: 'Coartada', color: 'GREEN', trigger: 'ON_PLAY', targetRules: 'SELF' },
  ];
  game = act(game, actor, ACTION.DRAW_CARDS);
  assert.equal(game.phase, GAME_STATUS.DAY);
  assert.equal(game.deck.length, 1);
  assert.equal(game.history.filter((entry) => entry.type === 'NIGHT_STARTED').length, 0);
});

test('la Noche comienza exactamente al robar la ultima carta del mazo principal', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  game.deck = [{ id: 'last_main_card', key: 'ALIBI', name: 'Coartada', color: 'GREEN', trigger: 'ON_PLAY', targetRules: 'SELF' }];
  game = act(game, actor, ACTION.DRAW_CARDS);
  assert.equal(game.phase, GAME_STATUS.NIGHT);
  assert.equal(game.subPhase, SUB_PHASE.WITCH_SELECTION);
  assert.equal(game.deck.length, 0);
  assert.deepEqual(game.interruptedTurn, { playerId: actor, remainingDraws: 1 });
  assert.equal(game.history.filter((entry) => entry.type === 'NIGHT_STARTED').length, 1);
});

test('si la ultima carta es Conspiracion, se resuelve antes de comenzar la Noche', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  game.deck = [{ id: 'last_conspiracy', key: 'CONSPIRACY', name: 'Conspiracion', color: 'BLACK', trigger: 'ON_DRAW', targetRules: 'TRYAL_CARD' }];
  game = act(game, actor, ACTION.DRAW_CARDS);
  assert.equal(game.subPhase, SUB_PHASE.CONSPIRACY_RESOLUTION);
  assert.equal(game.pendingNightAfterDraw, true);
  for (const id of game.turnOrder.filter((playerId) => game.players[playerId].alive)) {
    game = act(game, id, ACTION.SELECT_CONSPIRACY_CARD, { tryalCardIndex: 0 }, id);
  }
  game = revealBlackCatAfterConspiracy(game, 'before_night');
  assert.equal(game.phase, GAME_STATUS.NIGHT);
  assert.equal(game.subPhase, SUB_PHASE.WITCH_SELECTION);
  assert.equal(game.pendingNightAfterDraw, false);
  assert.equal(game.history.filter((entry) => entry.type === 'NIGHT_STARTED').length, 1);
});

test('las cartas de Casamiento no vuelven al mazo cuando se recicla el descarte', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  const definition = buildTownDeck(4).find((card) => card.key === 'MATCHMAKER');
  const spentIds = ['spent_matchmaker_1', 'spent_matchmaker_2'];
  game.deck = [];
  game.discard = [
    { ...definition, id: spentIds[0] },
    { id: 'reusable_1', key: 'ALIBI', name: 'Coartada', color: 'GREEN', trigger: 'ON_PLAY', targetRules: 'SELF' },
    { ...definition, id: spentIds[1] },
    { id: 'reusable_2', key: 'ALIBI', name: 'Coartada', color: 'GREEN', trigger: 'ON_PLAY', targetRules: 'SELF' },
    { id: 'reusable_3', key: 'ALIBI', name: 'Coartada', color: 'GREEN', trigger: 'ON_PLAY', targetRules: 'SELF' },
  ];

  game = act(game, actor, ACTION.DRAW_CARDS);

  assert.ok(spentIds.every((id) => game.retiredCards.some((card) => card.id === id)));
  assert.ok(!game.deck.some((card) => card.key === 'MATCHMAKER'));
  assert.ok(!game.players[actor].hand.some((card) => spentIds.includes(card.id)));
  assert.equal(game.deck.length, 1);
});

test('Casamiento requiere asignar sus dos cartas a personas distintas antes de activar el vinculo mortal', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  const witch = game.turnOrder.find((id) => game.players[id].tryalCards.some((card) => card.type === TRYAL.WITCH && !card.revealed));
  const partner = game.turnOrder.find((id) => id !== witch);
  const definition = buildTownDeck(4).find((card) => card.key === 'MATCHMAKER');
  const firstCard = { ...definition, id: 'matchmaker_test_1' };
  const secondCard = { ...definition, id: 'matchmaker_test_2' };
  game.players[actor].hand.unshift(firstCard, secondCard);

  const firstAction = GameEngine.buildPlayerView(game, actor).privateState.legalActions.find((item) => item.cardId === firstCard.id);
  assert.equal(firstAction.targetCount, 1);
  assert.ok(firstAction.targets.includes(witch));
  game = act(game, actor, ACTION.PLAY_CARD, { cardId: firstCard.id, targetId: witch });

  assert.equal(game.players[witch].matchmakerCards.length, 1);
  assert.equal(game.players[witch].marriedTo, null);
  assert.equal(game.players[partner].marriedTo, null);
  assert.equal(game.history.filter((entry) => entry.type === 'MARRIAGE_CARD_ASSIGNED').length, 1);
  assert.equal(game.history.filter((entry) => entry.type === 'MARRIAGE_CREATED').length, 0);
  assert.ok(!game.discard.some((card) => card.id === firstCard.id));

  const secondAction = GameEngine.buildPlayerView(game, actor).privateState.legalActions.find((item) => item.cardId === secondCard.id);
  assert.equal(secondAction.targetCount, 1);
  assert.ok(!secondAction.targets.includes(witch));
  assert.ok(secondAction.targets.includes(partner));
  assert.throws(() => act(game, actor, ACTION.PLAY_CARD, { cardId: secondCard.id, targetId: witch }), (error) => error.code === 'INVALID_TARGET');

  const beforeMarriage = structuredClone(game);
  beforeMarriage.subPhase = SUB_PHASE.TRYAL_SELECTION;
  beforeMarriage.pendingActions = { accusedId: witch, accuserId: actor };
  const pendingWitchCard = beforeMarriage.players[witch].tryalCards.find((card) => card.type === TRYAL.WITCH && !card.revealed);
  const deathBeforeMarriage = act(beforeMarriage, actor, ACTION.SELECT_TRYAL, { targetId: witch, tryalCardId: pendingWitchCard.id }, 'before_marriage');
  assert.equal(deathBeforeMarriage.players[witch].alive, false);
  assert.equal(deathBeforeMarriage.players[partner].alive, true);
  assert.ok(deathBeforeMarriage.retiredCards.some((card) => card.id === firstCard.id));
  assert.ok(!deathBeforeMarriage.discard.some((card) => card.id === firstCard.id));

  game = act(game, actor, ACTION.PLAY_CARD, { cardId: secondCard.id, targetId: partner });
  assert.equal(game.players[witch].marriedTo, partner);
  assert.equal(game.players[partner].marriedTo, witch);
  assert.equal(game.players[partner].matchmakerCards.length, 1);
  assert.equal(game.history.filter((entry) => entry.type === 'MARRIAGE_CREATED').length, 1);
  assert.equal(GameEngine.buildPlayerView(game, partner).publicState.players[witch].matchmakerCardCount, 1);

  game.subPhase = SUB_PHASE.TRYAL_SELECTION;
  game.pendingActions = { accusedId: witch, accuserId: actor };
  const witchCard = game.players[witch].tryalCards.find((card) => card.type === TRYAL.WITCH && !card.revealed);
  game = act(game, actor, ACTION.SELECT_TRYAL, { targetId: witch, tryalCardId: witchCard.id });
  assert.equal(game.players[witch].alive, false);
  assert.equal(game.players[partner].alive, false);
  assert.equal(game.players[partner].deathReason, 'MARRIAGE_BOND');
  assert.ok(game.history.some((entry) => entry.type === 'MARRIAGE_DEATH'));
});

test('Asilo no bloquea acusaciones durante el dia aunque sea el unico objetivo disponible', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  const target = game.turnOrder.find((id) => id !== actor);
  game.turnOrder.filter((id) => ![actor, target].includes(id)).forEach((id) => { game.players[id].alive = false; });
  game.players[target].blueCards.push({ id: 'asylum_test', key: 'ASYLUM', name: 'Asilo / Proteccion', color: 'BLUE', duration: 'PERMANENT' });
  game.players[actor].hand.unshift({ id: 'accusation_allowed', key: 'ACCUSATION', name: 'Acusacion', color: 'RED', points: 1, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER' });
  const action = GameEngine.buildPlayerView(game, actor).privateState.legalActions.find((item) => item.cardId === 'accusation_allowed');
  assert.deepEqual(action.targets, [target]);

  game = act(game, actor, ACTION.PLAY_CARD, { cardId: 'accusation_allowed', targetId: target });
  assert.equal(game.players[target].accusationTotal, 1);
  assert.equal(game.players[target].blueCards[0].duration, 'PERMANENT');
});

test('asignar el Gato Negro al inicio no revela una carta de Juicio', () => {
  let game = started();
  const witch = game.turnOrder.find((id) => game.players[id].isCurrentWitch);
  const target = game.turnOrder.find((id) => id !== witch);
  const revealedBefore = game.players[target].tryalCards.filter((card) => card.revealed).length;
  game = act(game, witch, ACTION.SELECT_BLACK_CAT, { targetId: target });
  assert.equal(game.phase, GAME_STATUS.DAY);
  assert.equal(game.subPhase, SUB_PHASE.WAITING_ACTION);
  assert.equal(game.players[target].hasBlackCat, true);
  assert.equal(game.players[target].tryalCards.filter((card) => card.revealed).length, revealedBefore);
  assert.equal(GameEngine.buildPlayerView(game, target).privateState.legalActions.some((item) => item.type === ACTION.SELECT_TRYAL), false);
});

test('el Gato Negro obliga a revelar una carta despues de Conspiracion', () => {
  let game = beginDay(started());
  const holder = game.turnOrder.find((id) => game.players[id].hasBlackCat);
  game.subPhase = SUB_PHASE.CONSPIRACY_RESOLUTION;
  game.pendingActions = { conspiracySelections: {} };
  for (const id of game.turnOrder) game = act(game, id, ACTION.SELECT_CONSPIRACY_CARD, { tryalCardIndex: 0 }, id);
  assert.equal(game.subPhase, SUB_PHASE.TRYAL_SELECTION);
  assert.equal(game.pendingActions.accusedId, holder);
  assert.equal(game.pendingActions.resumeAfter, 'CONSPIRACY');
  assert.equal(GameEngine.buildPlayerView(game, holder).publicState.pendingAction.reason, 'BLACK_CAT');
  assert.equal(GameEngine.buildPlayerView(game, holder).privateState.legalActions.some((item) => item.type === ACTION.SELECT_TRYAL), true);
});

test('el segundo robo se reanuda despues de resolver Conspiracy', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  game.deck = [
    { id: 'conspiracy_resume', key: 'CONSPIRACY', name: 'Conspiracion', color: 'BLACK', trigger: 'ON_DRAW', targetRules: 'TRYAL_CARD' },
    { id: 'alibi_resume', key: 'ALIBI', name: 'Coartada', color: 'GREEN', trigger: 'ON_PLAY', targetRules: 'SELF' },
    ...game.deck,
  ];
  const nextPlayer = game.turnOrder[(game.turn.index + 1) % game.turnOrder.length];
  game = act(game, actor, ACTION.DRAW_CARDS);
  assert.equal(game.subPhase, SUB_PHASE.CONSPIRACY_RESOLUTION);
  assert.deepEqual(game.interruptedTurn, { playerId: actor, remainingDraws: 1 });
  for (const id of game.turnOrder.filter((playerId) => game.players[playerId].alive)) {
    game = act(game, id, ACTION.SELECT_CONSPIRACY_CARD, { tryalCardIndex: 0 }, id);
  }
  game = revealBlackCatAfterConspiracy(game, 'resume_draw');
  assert.ok(game.players[actor].hand.some((card) => card.id === 'alibi_resume'));
  assert.equal(game.currentPlayerId, nextPlayer);
  assert.equal(game.interruptedTurn, null);
});

test('si quien agoto el mazo muere durante la Noche, su robo pendiente se cancela y avanza el turno', () => {
  let game = beginDay(started());
  const actor = game.turnOrder.find((id) => !game.players[id].hasEverBeenWitch);
  const actorIndex = game.turnOrder.indexOf(actor);
  const nextPlayer = game.turnOrder[(actorIndex + 1) % game.turnOrder.length];
  game.currentPlayerId = actor;
  game.turn.index = actorIndex;
  game.deck = [{ id: 'last_before_night', key: 'ALIBI', name: 'Coartada', color: 'GREEN', trigger: 'ON_PLAY', targetRules: 'SELF' }];
  game.discard.unshift({ id: 'never_drawn', key: 'ALIBI', name: 'Coartada', color: 'GREEN', trigger: 'ON_PLAY', targetRules: 'SELF' });
  game = act(game, actor, ACTION.DRAW_CARDS);
  const witches = game.turnOrder.filter((id) => game.players[id].alive && game.players[id].hasEverBeenWitch);
  for (const witch of witches) game = act(game, witch, ACTION.SELECT_WITCH_VICTIM, { targetId: actor }, witch);
  const constable = game.turnOrder.find((id) => game.players[id].alive && game.players[id].isCurrentConstable);
  if (constable) {
    const protectionTarget = game.turnOrder.find((id) => game.players[id].alive && id !== constable && id !== actor);
    game = act(game, constable, ACTION.SELECT_CONSTABLE_PROTECTION, { targetId: protectionTarget });
  }
  for (const id of game.turnOrder.filter((id) => game.players[id].alive)) game = act(game, id, ACTION.PASS_CONFESSION, {}, id);
  assert.equal(game.subPhase, SUB_PHASE.LAST_WORDS);
  game = act(game, actor, ACTION.END_LAST_WORDS);
  assert.equal(game.phase, GAME_STATUS.DAY);
  assert.equal(game.subPhase, SUB_PHASE.WAITING_ACTION);
  assert.equal(game.currentPlayerId, nextPlayer);
  assert.equal(game.interruptedTurn, null);
  assert.ok(!game.players[actor].hand.some((card) => card.id === 'never_drawn'));
});

test('la ronda aumenta al volver al primer jugador vivo', () => {
  let game = beginDay(started());
  const startingRound = game.round;
  const aliveCount = game.turnOrder.filter((id) => game.players[id].alive).length;
  for (let index = 0; index < aliveCount; index += 1) game = act(game, game.currentPlayerId, ACTION.END_TURN, {}, index);
  assert.equal(game.round, startingRound + 1);
});

test('cualquier miembro puede resolver un timeout vencido', () => {
  let game = beginDay(started());
  const nonHost = game.turnOrder.find((id) => !game.players[id].isHost);
  game.timers.phaseEndsAt = 10;
  game = GameEngine.executeAction(game, nonHost, {
    actionId: 'timeout_shared', expectedVersion: game.version, type: ACTION.APPLY_TIMEOUT, payload: {},
  }, { rng, now: 11 });
  assert.equal(game.currentPlayerId, 'p2');
});

test('Conspiracy aplica todas las transferencias simultaneamente y recalcula Witch/Constable', () => {
  let game = beginDay(started());
  game.subPhase = SUB_PHASE.CONSPIRACY_RESOLUTION;
  game.pendingActions = { conspiracySelections: {} };
  const expected = Object.fromEntries(game.turnOrder.map((toId, index) => {
    const fromId = game.turnOrder[(index - 1 + game.turnOrder.length) % game.turnOrder.length];
    return [toId, { fromId, cardId: game.players[fromId].tryalCards.find((card) => !card.revealed).id }];
  }));
  const firstView = GameEngine.buildPlayerView(game, game.turnOrder[0]);
  const firstChoice = firstView.privateState.legalActions.find((item) => item.type === ACTION.SELECT_CONSPIRACY_CARD);
  assert.equal(firstChoice.sourceId, expected[game.turnOrder[0]].fromId);
  assert.ok(firstChoice.tryalOptions.every((choice) => Number.isInteger(choice)));
  for (const id of game.turnOrder) game = act(game, id, ACTION.SELECT_CONSPIRACY_CARD, { tryalCardIndex: 0 }, id);
  game.turnOrder.forEach((toId) => {
    assert.ok(game.players[toId].tryalCards.some((card) => card.id === expected[toId].cardId));
    assert.equal(game.players[toId].lastConspiracyCard.fromId, expected[toId].fromId);
  });
  const witchOwner = game.turnOrder.find((id) => game.players[id].tryalCards.some((card) => card.type === TRYAL.WITCH && !card.revealed));
  const constableOwner = game.turnOrder.find((id) => game.players[id].tryalCards.some((card) => card.type === TRYAL.CONSTABLE && !card.revealed));
  assert.equal(game.players[witchOwner].isCurrentWitch, true);
  assert.equal(game.players[witchOwner].hasEverBeenWitch, true);
  assert.equal(game.players[constableOwner].isCurrentConstable, true);
});

test('7 puntos inician juicio; revelar WITCH mata y da victoria al Pueblo', () => {
  let game = beginDay(started());
  const accused = game.turnOrder.find((id) => game.players[id].tryalCards.some((card) => card.type === TRYAL.WITCH));
  const actor = game.turnOrder.find((id) => id !== accused);
  game.currentPlayerId = actor;
  game.turn.index = game.turnOrder.indexOf(actor);
  game.players[actor].hand.unshift({ id: 'witness_test', key: 'WITNESS', name: 'Testigo', color: 'RED', points: 7, trigger: 'ON_PLAY', targetRules: 'OTHER_PLAYER' });
  game = act(game, actor, ACTION.PLAY_CARD, { cardId: 'witness_test', targetId: accused });
  assert.equal(game.subPhase, SUB_PHASE.TRYAL_SELECTION);
  const witchCard = game.players[accused].tryalCards.find((card) => card.type === TRYAL.WITCH);
  game = act(game, actor, ACTION.SELECT_TRYAL, { targetId: accused, tryalCardId: witchCard.id });
  assert.equal(game.players[accused].accusationTotal, 0);
  assert.deepEqual(game.players[accused].accusations, []);
  assert.equal(game.players[accused].alive, false);
  assert.equal(game.status, GAME_STATUS.FINISHED);
  assert.equal(game.winner, 'TOWN');
  assert.equal(game.subPhase, SUB_PHASE.LAST_WORDS);
  assert.ok(GameEngine.buildPlayerView(game, accused).privateState.legalActions.some((item) => item.type === ACTION.END_LAST_WORDS));
  game = act(game, accused, ACTION.END_LAST_WORDS);
  assert.equal(game.players[accused].canCommunicate, false);
  const publicAccused = GameEngine.buildPlayerView(game, actor).publicState.players[accused];
  assert.equal(publicAccused.wasEverWitch, true);
});

test('revelar las cinco cartas de Juicio mata aunque ninguna sea Bruja', () => {
  let game = beginDay(started());
  const actor = game.currentPlayerId;
  const target = game.turnOrder.find((id) => id !== actor && !game.players[id].tryalCards.some((card) => card.type === TRYAL.WITCH));
  const cards = game.players[target].tryalCards;
  cards.slice(0, -1).forEach((card) => { card.revealed = true; });
  game.players[target].accusations = [{ points: 7 }];
  game.players[target].accusationTotal = 7;
  game.subPhase = SUB_PHASE.TRYAL_SELECTION;
  game.pendingActions = { accusedId: target, accuserId: actor };
  game = act(game, actor, ACTION.SELECT_TRYAL, { targetId: target, tryalCardId: cards.at(-1).id });
  assert.equal(game.players[target].alive, false);
  assert.equal(game.players[target].deathReason, 'ALL_TRYALS_REVEALED');
  assert.equal(game.players[target].accusationTotal, 0);
  assert.equal(GameEngine.buildPlayerView(game, actor).publicState.players[target].wasEverWitch, false);
});

test('si todos los vivos han sido bruja, ganan WITCHES', () => {
  let game = beginDay(started());
  game.turnOrder.forEach((id) => { game.players[id].hasEverBeenWitch = true; });
  const actor = game.currentPlayerId;
  const target = game.turnOrder.find((id) => id !== actor);
  const card = game.players[target].tryalCards.find((item) => item.type === TRYAL.NOT_WITCH && !item.revealed);
  game.subPhase = SUB_PHASE.TRYAL_SELECTION;
  game.pendingActions = { accusedId: target, accuserId: actor };
  game = act(game, actor, ACTION.SELECT_TRYAL, { targetId: target, tryalCardId: card.id });
  assert.equal(game.winner, 'WITCHES');
});

test('proteccion del Alguacil evita la muerte nocturna y se limpia al amanecer', () => {
  let game = beginDay(started());
  const witch = game.turnOrder.find((id) => game.players[id].hasEverBeenWitch);
  const victim = game.turnOrder.find((id) => id !== witch);
  const constable = game.turnOrder.find((id) => game.players[id].isCurrentConstable);
  game.status = GAME_STATUS.NIGHT; game.phase = GAME_STATUS.NIGHT; game.subPhase = SUB_PHASE.WITCH_SELECTION;
  game.pendingActions = { witchVotes: {}, protection: null, confessions: {} };
  game = act(game, witch, ACTION.SELECT_WITCH_VICTIM, { targetId: victim });
  if (constable === victim) {
    game.players[constable].isCurrentConstable = false;
    const replacement = game.turnOrder.find((id) => id !== victim);
    game.players[replacement].isCurrentConstable = true;
    game = act(game, replacement, ACTION.SELECT_CONSTABLE_PROTECTION, { targetId: victim });
  } else game = act(game, constable, ACTION.SELECT_CONSTABLE_PROTECTION, { targetId: victim });
  for (const id of game.turnOrder.filter((id) => game.players[id].alive)) game = act(game, id, ACTION.PASS_CONFESSION, {}, id);
  assert.equal(game.players[victim].alive, true);
  assert.equal(game.players[victim].protectedTonight, false);
  assert.equal(game.phase, GAME_STATUS.DAY);
});

test('Asilo impide el ataque de la Noche y permanece despues del amanecer', () => {
  let game = beginDay(started());
  const witch = game.turnOrder.find((id) => game.players[id].hasEverBeenWitch);
  const victim = game.turnOrder.find((id) => id !== witch && !game.players[id].hasEverBeenWitch);
  const constable = game.turnOrder.find((id) => game.players[id].isCurrentConstable);
  game.players[victim].blueCards.push({ id: 'asylum_night', key: 'ASYLUM', name: 'Asilo / Proteccion', color: 'BLUE', duration: 'PERMANENT' });
  game.status = GAME_STATUS.NIGHT; game.phase = GAME_STATUS.NIGHT; game.subPhase = SUB_PHASE.WITCH_SELECTION;
  game.pendingActions = { witchVotes: {}, protection: null, confessions: {} };
  game = act(game, witch, ACTION.SELECT_WITCH_VICTIM, { targetId: victim });
  if (constable) {
    const otherTarget = game.turnOrder.find((id) => game.players[id].alive && id !== constable && id !== victim);
    game = act(game, constable, ACTION.SELECT_CONSTABLE_PROTECTION, { targetId: otherTarget });
  }
  for (const id of game.turnOrder.filter((id) => game.players[id].alive)) game = act(game, id, ACTION.PASS_CONFESSION, {}, id);
  assert.equal(game.players[victim].alive, true);
  assert.ok(game.players[victim].blueCards.some((card) => card.id === 'asylum_night'));
  assert.equal(game.phase, GAME_STATUS.DAY);
});

test('confesion valida protege durante esa noche y revela publicamente la carta', () => {
  let game = beginDay(started());
  const witch = game.turnOrder.find((id) => game.players[id].hasEverBeenWitch);
  const victim = game.turnOrder.find((id) => id !== witch);
  const confession = game.players[victim].tryalCards.find((card) => card.type === TRYAL.NOT_WITCH && !card.revealed);
  game.status = GAME_STATUS.NIGHT; game.phase = GAME_STATUS.NIGHT; game.subPhase = SUB_PHASE.CONFESSION;
  game.pendingActions = { witchVotes: { [witch]: victim }, protection: null, confessions: {} };
  game = act(game, victim, ACTION.CONFESS, { tryalCardId: confession.id });
  assert.equal(game.players[victim].confessedTonight, true);
  for (const id of game.turnOrder.filter((id) => id !== victim && game.players[id].alive)) game = act(game, id, ACTION.PASS_CONFESSION, {}, id);
  assert.equal(game.players[victim].alive, true);
  assert.equal(game.players[victim].confessedTonight, false);
});
