import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, ref, set } from 'firebase/database';

const apiBase = 'https://salem-1692-app.vercel.app';
const firebaseConfig = {
  apiKey: 'AIzaSyDT1-UBdoACSWmIz8I2yvGUJvGIKfuJ8FQ',
  authDomain: 'salem-1692-16b8b.firebaseapp.com',
  databaseURL: 'https://salem-1692-16b8b-default-rtdb.firebaseio.com',
  projectId: 'salem-1692-16b8b',
  storageBucket: 'salem-1692-16b8b.firebasestorage.app',
  messagingSenderId: '1038421119986',
  appId: '1:1038421119986:web:5287d1283742b91ddc916b',
};

async function createUser(index) {
  const app = initializeApp(firebaseConfig, `production-test-${Date.now()}-${index}`);
  const credential = await signInAnonymously(getAuth(app));
  return {
    app,
    db: getDatabase(app),
    uid: credential.user.uid,
    token: await credential.user.getIdToken(),
  };
}

async function post(path, user, body) {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${user.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}

const users = await Promise.all(Array.from({ length: 4 }, (_, index) => createUser(index)));

try {
  const created = await post('/api/create-game', users[0], { displayName: 'Prueba Vercel 1' });

  for (let index = 1; index < users.length; index += 1) {
    await post('/api/join-game', users[index], {
      inviteCode: created.inviteCode,
      displayName: `Prueba Vercel ${index + 1}`,
    });
  }

  await Promise.all(users.map((user) => set(ref(user.db, `presence/${created.gameId}/${user.uid}`), {
    connected: true,
    updatedAt: Date.now(),
  })));

  const before = (await get(ref(users[0].db, `games/${created.gameId}/public`))).val();
  assert.equal(before.version, 3);
  assert.equal(Object.keys(before.players).length, 4);

  await post('/api/game-action', users[0], {
    gameId: created.gameId,
    action: {
      actionId: `production_start_${Date.now()}`,
      expectedVersion: before.version,
      type: 'START_GAME',
      payload: {},
    },
  });

  const after = (await get(ref(users[0].db, `games/${created.gameId}/public`))).val();
  assert.equal(after.phase, 'DAWN');
  assert.equal(Object.keys(after.players).length, 4);
  assert.equal(after.players[users[0].uid].hand, undefined);

  process.stdout.write(`${JSON.stringify({
    gameId: created.gameId,
    inviteCode: created.inviteCode,
    players: Object.keys(after.players).length,
    phase: after.phase,
    privateHandsExposed: false,
    result: 'PASS',
  }, null, 2)}\n`);
} finally {
  await Promise.all(users.map((user) => deleteApp(user.app)));
}
