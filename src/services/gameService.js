import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { onDisconnect, onValue, ref, serverTimestamp, set } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';

const createGameCall = httpsCallable(functions, 'createGame');
const joinGameCall = httpsCallable(functions, 'joinGame');
const executeGameActionCall = httpsCallable(functions, 'executeGameAction');
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const emulatorCalls = { createGame: createGameCall, joinGame: joinGameCall, executeGameAction: executeGameActionCall };

export async function ensurePlayerIdentity() {
  if (auth.currentUser) return auth.currentUser;
  const existing = await new Promise((resolve) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(auth, (user) => { unsubscribe(); resolve(user); });
  });
  if (existing) return existing;
  return (await signInAnonymously(auth)).user;
}

async function callBackend(name, data) {
  const user = await ensurePlayerIdentity();
  if (useEmulators) return (await emulatorCalls[name](data)).data;
  const endpoint = { createGame: 'create-game', joinGame: 'join-game', executeGameAction: 'game-action' }[name];
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || 'No se pudo completar la accion.');
    error.code = result.error?.code;
    throw error;
  }
  return result;
}

async function saveSession(name, data) {
  const result = await callBackend(name, data);
  localStorage.setItem('salem-session', JSON.stringify(result));
  return result;
}

export const createGame = (displayName) => saveSession('createGame', { displayName });
export const joinGame = (inviteCode, displayName) => saveSession('joinGame', { inviteCode, displayName });

export function restoreSession() {
  try { return JSON.parse(localStorage.getItem('salem-session')); }
  catch { return null; }
}

export function clearSession() {
  localStorage.removeItem('salem-session');
}

export function sessionAccessWasLost(error) {
  return ['PERMISSION_DENIED', 'permission-denied'].includes(error?.code);
}

export function subscribeToPlayerView(gameId, playerId, onChange, onError) {
  let publicState = null;
  let privateState = null;
  let presenceState = null;
  const emit = () => {
    if (!publicState || !privateState) return;
    const players = presenceState === null ? publicState.players : Object.fromEntries(
      Object.entries(publicState.players || {}).map(([id, player]) => [id, { ...player, connected: presenceState[id]?.connected === true }]),
    );
    onChange({ publicState: { ...publicState, players }, privateState });
  };
  const stopPublic = onValue(ref(db, `games/${gameId}/public`), (snapshot) => { publicState = snapshot.val(); emit(); }, onError);
  const stopPrivate = onValue(ref(db, `games/${gameId}/private/${playerId}`), (snapshot) => { privateState = snapshot.val(); emit(); }, onError);
  const presenceRef = ref(db, `presence/${gameId}/${playerId}`);
  const stopPresence = onValue(ref(db, `presence/${gameId}`), (snapshot) => { presenceState = snapshot.val() || {}; emit(); }, onError);
  const disconnect = onDisconnect(presenceRef);
  disconnect.set({ connected: false, updatedAt: serverTimestamp() }).catch(onError);
  set(presenceRef, { connected: true, updatedAt: serverTimestamp() }).catch(onError);
  return () => {
    stopPublic();
    stopPrivate();
    stopPresence();
    disconnect.cancel().catch(() => {});
    set(presenceRef, { connected: false, updatedAt: serverTimestamp() }).catch(() => {});
  };
}

export async function executeGameAction(gameId, version, type, payload = {}) {
  const actionId = type === 'APPLY_TIMEOUT'
    ? `timeout_${gameId}_${version}`
    : globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return callBackend('executeGameAction', { gameId, action: { actionId, expectedVersion: version, type, payload } });
}
