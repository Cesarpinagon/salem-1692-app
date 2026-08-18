import assert from 'node:assert/strict';
import { deleteApp } from 'firebase-admin/app';

globalThis.process.env.FIREBASE_DATABASE_EMULATOR_HOST ||= '127.0.0.1:9000';
globalThis.process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

const projectId = 'salem-1692-16b8b';
const apiKey = 'fake-api-key';

async function anonymousUser() {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!response.ok) assert.fail(await response.text());
  const result = await response.json();
  return { uid: result.localId, token: result.idToken };
}

async function invoke(handler, token, body) {
  let statusCode = 200;
  let responseBody;
  const response = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { responseBody = value; return this; },
  };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body }, response);
  assert.equal(statusCode, 200, JSON.stringify(responseBody));
  return responseBody;
}

const [{ default: createHandler }, { default: joinHandler }, { default: actionHandler }, { getAdminDb }] = await Promise.all([
  import('../api/create-game.js'),
  import('../api/join-game.js'),
  import('../api/game-action.js'),
  import('../api/_lib/firebaseAdmin.js'),
]);
const adminDb = getAdminDb();

const users = await Promise.all(Array.from({ length: 4 }, () => anonymousUser()));
const created = await invoke(createHandler, users[0].token, { displayName: 'API Host' });
for (let index = 1; index < users.length; index += 1) {
  await invoke(joinHandler, users[index].token, { inviteCode: created.inviteCode, displayName: `API Player ${index + 1}` });
}
await adminDb.ref(`presence/${created.gameId}`).set(Object.fromEntries(users.map((user) => [user.uid, { connected: true, updatedAt: Date.now() }])));
const before = await adminDb.ref(`games/${created.gameId}/public`).get().then((snapshot) => snapshot.val());
assert.equal(before.version, 3);
await invoke(actionHandler, users[0].token, {
  gameId: created.gameId,
  action: { actionId: `api_start_${Date.now()}`, expectedVersion: before.version, type: 'START_GAME', payload: {} },
});
const after = await adminDb.ref(`games/${created.gameId}/public`).get().then((snapshot) => snapshot.val());
assert.equal(after.phase, 'DAWN');
assert.equal(Object.keys(after.players).length, 4);
assert.equal(after.players[users[0].uid].hand, undefined);

console.log(JSON.stringify({ gameId: created.gameId, inviteCode: created.inviteCode, phase: after.phase, result: 'PASS' }, null, 2));
await deleteApp(adminDb.app);
