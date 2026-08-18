import { initializeApp } from 'firebase-admin/app';
import { getDatabase, ServerValue } from 'firebase-admin/database';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onValueWritten } from 'firebase-functions/v2/database';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { randomInt } from 'node:crypto';
import { GameEngine, GameRuleError } from './game/engine.js';

initializeApp({
  databaseURL: globalThis.process?.env.FIREBASE_DATABASE_URL || 'https://salem-1692-16b8b-default-rtdb.firebaseio.com',
});

const normalizeCode = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
const normalizeGameId = (value) => String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
const inviteAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeInviteCode = () => Array.from({ length: 6 }, () => inviteAlphabet[randomInt(inviteAlphabet.length)]).join('');

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Debes autenticarte para jugar.');
  return request.auth.uid;
}

function playerViews(game) {
  const privateViews = {};
  let publicState = null;
  game.turnOrder.forEach((playerId) => {
    const view = GameEngine.buildPlayerView(game, playerId);
    publicState ||= view.publicState;
    privateViews[playerId] = view.privateState;
  });
  return { publicState, privateViews };
}

function persistedGame(game) {
  const { publicState, privateViews } = playerViews(game);
  return JSON.parse(JSON.stringify({ serverState: game, public: publicState, private: privateViews }));
}

function asHttpsError(error) {
  if (error instanceof HttpsError) return error;
  if (error instanceof GameRuleError) return new HttpsError('failed-precondition', error.message, { code: error.code });
  console.error(error);
  return new HttpsError('internal', 'No se pudo procesar la accion.');
}

export const createGame = onCall(async (request) => {
  const uid = requireAuth(request);
  const name = normalizeName(request.data?.displayName);
  if (!name) throw new HttpsError('invalid-argument', 'El nombre es obligatorio.');
  const database = getDatabase();
  const gameId = database.ref('games').push().key;
  let inviteCode;
  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = makeInviteCode();
      const claim = await database.ref(`inviteCodes/${candidate}`).transaction((current) => current || gameId, undefined, false);
      if (claim.committed && claim.snapshot.val() === gameId) { inviteCode = candidate; break; }
    }
    if (!inviteCode) throw new HttpsError('resource-exhausted', 'No se pudo generar un codigo de invitacion.');
    const game = GameEngine.createGame({ id: gameId, inviteCode, host: { id: uid, firebaseUid: uid, name } });
    await database.ref(`games/${gameId}`).set(persistedGame(game));
    return { gameId, playerId: uid, inviteCode };
  } catch (error) {
    if (inviteCode) await database.ref(`inviteCodes/${inviteCode}`).remove().catch(() => {});
    throw asHttpsError(error);
  }
});

export const joinGame = onCall(async (request) => {
  const uid = requireAuth(request);
  const inviteCode = normalizeCode(request.data?.inviteCode);
  const name = normalizeName(request.data?.displayName);
  if (inviteCode.length !== 6 || !name) throw new HttpsError('invalid-argument', 'Nombre y codigo de 6 caracteres son obligatorios.');
  const database = getDatabase();
  const gameId = await database.ref(`inviteCodes/${inviteCode}`).get().then((snapshot) => snapshot.val());
  if (!gameId) throw new HttpsError('not-found', 'No existe una sala con ese codigo.');
  const gameRef = database.ref(`games/${gameId}`);
  const initialContainer = await gameRef.get().then((snapshot) => snapshot.val());
  if (!initialContainer?.serverState) throw new HttpsError('not-found', 'La partida no existe.');
  let playerId = uid;
  try {
    const result = await gameRef.transaction((container) => {
      container ||= structuredClone(initialContainer);
      if (!container?.serverState) throw new GameRuleError('GAME_NOT_FOUND', 'La partida no existe.');
      const game = container.serverState;
      const existing = Object.values(game.players).find((player) => player.firebaseUid === uid);
      if (existing) {
        playerId = existing.id;
        game.players[playerId].connected = true;
        game.players[playerId].name = name;
        return persistedGame(game);
      }
      return persistedGame(GameEngine.addPlayer(game, { id: playerId, firebaseUid: uid, name }));
    }, undefined, false);
    if (!result.committed) throw new HttpsError('aborted', 'No se pudo entrar a la sala.');
    return { gameId, playerId, inviteCode };
  } catch (error) { throw asHttpsError(error); }
});

export const executeGameAction = onCall(async (request) => {
  const uid = requireAuth(request);
  const gameId = normalizeGameId(request.data?.gameId);
  const action = request.data?.action;
  if (!gameId || !action) throw new HttpsError('invalid-argument', 'Partida y accion son obligatorias.');
  const gameRef = getDatabase().ref(`games/${gameId}`);
  try {
    const initialContainer = await gameRef.get().then((snapshot) => snapshot.val());
    if (!initialContainer?.serverState) throw new GameRuleError('GAME_NOT_FOUND', 'La partida no existe.');
    const result = await gameRef.transaction((container) => {
      container ||= structuredClone(initialContainer);
      if (!container?.serverState) throw new GameRuleError('GAME_NOT_FOUND', 'La partida no existe.');
      const game = container.serverState;
      const player = Object.values(game.players).find((candidate) => candidate.firebaseUid === uid);
      if (!player) throw new GameRuleError('NOT_IN_GAME', 'No perteneces a la partida.');
      const next = GameEngine.executeAction(game, player.id, action);
      return persistedGame(next);
    }, undefined, false);
    if (!result.committed) throw new HttpsError('aborted', 'La accion no pudo confirmarse.');
    return { version: result.snapshot.child('serverState/version').val() };
  } catch (error) { throw asHttpsError(error); }
});

export const updateConnection = onCall(async (request) => {
  const uid = requireAuth(request);
  const gameId = normalizeGameId(request.data?.gameId);
  const connected = Boolean(request.data?.connected);
  const gameRef = getDatabase().ref(`games/${gameId}`);
  try {
    const initialContainer = await gameRef.get().then((snapshot) => snapshot.val());
    if (!initialContainer?.serverState) return { ok: false };
    await gameRef.transaction((container) => {
      container ||= structuredClone(initialContainer);
      if (!container?.serverState) return;
      const player = Object.values(container.serverState.players).find((candidate) => candidate.firebaseUid === uid);
      if (!player) return;
      player.connected = connected;
      container.serverState.updatedAt = ServerValue.TIMESTAMP;
      return persistedGame(container.serverState);
    }, undefined, false);
    return { ok: true };
  } catch (error) { throw asHttpsError(error); }
});

export const syncPlayerPresence = onValueWritten({
  ref: '/presence/{gameId}/{playerId}',
  instance: 'salem-1692-16b8b-default-rtdb',
}, async (event) => {
  const { gameId, playerId } = event.params;
  const connected = event.data.after.val()?.connected === true;
  const gameRef = getDatabase().ref(`games/${gameId}`);
  const initialContainer = await gameRef.get().then((snapshot) => snapshot.val());
  if (!initialContainer?.serverState?.players?.[playerId]) return;
  await gameRef.transaction((container) => {
    container ||= structuredClone(initialContainer);
    if (!container?.serverState?.players?.[playerId]) return container;
    container.serverState.players[playerId].connected = connected;
    container.serverState.updatedAt = new Date().toISOString();
    return persistedGame(container.serverState);
  }, undefined, false);
});

export const resolveExpiredDecisions = onSchedule({ schedule: 'every 1 minutes', region: 'us-central1' }, async () => {
  const database = getDatabase();
  const games = await database.ref('games').get();
  const now = Date.now();
  const jobs = [];
  games.forEach((snapshot) => {
    const initialContainer = snapshot.val();
    const game = initialContainer?.serverState;
    if (!game?.timers?.phaseEndsAt || game.timers.phaseEndsAt > now || game.status === 'FINISHED') return;
    const host = Object.values(game.players || {}).find((player) => player.isHost);
    if (!host) return;
    jobs.push(snapshot.ref.transaction((container) => {
      container ||= structuredClone(initialContainer);
      const current = container?.serverState;
      if (!current?.timers?.phaseEndsAt || current.timers.phaseEndsAt > now || current.status === 'FINISHED') return container;
      const next = GameEngine.executeAction(current, host.id, {
        actionId: `timeout_${current.timers.phaseEndsAt}`,
        expectedVersion: current.version,
        type: 'APPLY_TIMEOUT',
        payload: {},
      }, { now });
      return persistedGame(next);
    }, undefined, false));
  });
  await Promise.all(jobs);
});
