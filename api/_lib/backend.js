import { randomInt } from 'node:crypto';
import { GameEngine, GameRuleError } from '../../functions/src/game/engine.js';
import { getAdminAuth, getAdminDb } from './firebaseAdmin.js';

const normalizeCode = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
const normalizeGameId = (value) => String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
const inviteAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeInviteCode = () => Array.from({ length: 6 }, () => inviteAlphabet[randomInt(inviteAlphabet.length)]).join('');

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

function parseBody(body) {
  if (!body) return {};
  return typeof body === 'string' ? JSON.parse(body) : body;
}

async function authenticatedUid(request) {
  const match = String(request.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, 'UNAUTHENTICATED', 'Debes autenticarte para jugar.');
  try { return (await getAdminAuth().verifyIdToken(match[1])).uid; }
  catch { throw new ApiError(401, 'UNAUTHENTICATED', 'La sesion ya no es valida.'); }
}

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function asApiError(error) {
  if (error instanceof ApiError) return error;
  if (error instanceof GameRuleError) return new ApiError(409, error.code, error.message);
  if (error instanceof SyntaxError) return new ApiError(400, 'INVALID_JSON', 'La solicitud no contiene JSON valido.');
  console.error(error);
  return new ApiError(500, 'INTERNAL', error?.message === 'Falta configurar FIREBASE_SERVICE_ACCOUNT_JSON en Vercel.' ? error.message : 'No se pudo procesar la accion.');
}

export function httpHandler(operation) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Usa una solicitud POST.' } });
    }
    try {
      const uid = await authenticatedUid(request);
      return response.status(200).json(await operation(uid, parseBody(request.body)));
    } catch (cause) {
      const error = asApiError(cause);
      return response.status(error.status).json({ error: { code: error.code, message: error.message } });
    }
  };
}

export async function createGame(uid, data) {
  const adminDb = getAdminDb();
  const name = normalizeName(data?.displayName);
  if (!name) throw new ApiError(400, 'INVALID_NAME', 'El nombre es obligatorio.');
  const gameId = adminDb.ref('games').push().key;
  let inviteCode;
  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = makeInviteCode();
      const claim = await adminDb.ref(`inviteCodes/${candidate}`).transaction((current) => current || gameId, undefined, false);
      if (claim.committed && claim.snapshot.val() === gameId) { inviteCode = candidate; break; }
    }
    if (!inviteCode) throw new ApiError(503, 'INVITE_CODE_EXHAUSTED', 'No se pudo generar un codigo de invitacion.');
    const game = GameEngine.createGame({ id: gameId, inviteCode, host: { id: uid, firebaseUid: uid, name } });
    await adminDb.ref(`games/${gameId}`).set(persistedGame(game));
    return { gameId, playerId: uid, inviteCode };
  } catch (error) {
    if (inviteCode) await adminDb.ref(`inviteCodes/${inviteCode}`).remove().catch(() => {});
    throw error;
  }
}

export async function joinGame(uid, data) {
  const adminDb = getAdminDb();
  const inviteCode = normalizeCode(data?.inviteCode);
  const name = normalizeName(data?.displayName);
  if (inviteCode.length !== 6 || !name) throw new ApiError(400, 'INVALID_JOIN', 'Nombre y codigo de 6 caracteres son obligatorios.');
  const gameId = await adminDb.ref(`inviteCodes/${inviteCode}`).get().then((snapshot) => snapshot.val());
  if (!gameId) throw new ApiError(404, 'GAME_NOT_FOUND', 'No existe una sala con ese codigo.');
  const gameRef = adminDb.ref(`games/${gameId}`);
  const initialContainer = await gameRef.get().then((snapshot) => snapshot.val());
  if (!initialContainer?.serverState) throw new ApiError(404, 'GAME_NOT_FOUND', 'La partida no existe.');
  let playerId = uid;
  const result = await gameRef.transaction((container) => {
    container ||= structuredClone(initialContainer);
    if (!container?.serverState) return;
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
  if (!result.committed) throw new ApiError(409, 'JOIN_ABORTED', 'No se pudo entrar a la sala.');
  return { gameId, playerId, inviteCode };
}

export async function executeGameAction(uid, data) {
  const adminDb = getAdminDb();
  const gameId = normalizeGameId(data?.gameId);
  const action = data?.action;
  if (!gameId || !action) throw new ApiError(400, 'INVALID_ACTION', 'Partida y accion son obligatorias.');
  const gameRef = adminDb.ref(`games/${gameId}`);
  const [initialContainer, presence] = await Promise.all([
    gameRef.get().then((snapshot) => snapshot.val()),
    adminDb.ref(`presence/${gameId}`).get().then((snapshot) => snapshot.val() || {}),
  ]);
  if (!initialContainer?.serverState) throw new ApiError(404, 'GAME_NOT_FOUND', 'La partida no existe.');
  const result = await gameRef.transaction((container) => {
    container ||= structuredClone(initialContainer);
    if (!container?.serverState) return;
    const game = container.serverState;
    const player = Object.values(game.players).find((candidate) => candidate.firebaseUid === uid);
    if (!player) throw new GameRuleError('NOT_IN_GAME', 'No perteneces a la partida.');
    Object.values(game.players).forEach((candidate) => {
      candidate.connected = presence[candidate.id]?.connected === true;
    });
    return persistedGame(GameEngine.executeAction(game, player.id, action));
  }, undefined, false);
  if (!result.committed) throw new ApiError(409, 'ACTION_ABORTED', 'La accion no pudo confirmarse.');
  return { version: result.snapshot.child('serverState/version').val() };
}
