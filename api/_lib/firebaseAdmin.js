import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

const environment = globalThis.process?.env || {};
const projectId = environment.FIREBASE_PROJECT_ID || 'salem-1692-16b8b';
const databaseURL = environment.FIREBASE_DATABASE_URL || 'https://salem-1692-16b8b-default-rtdb.firebaseio.com';

function serverCredential() {
  if (environment.FIREBASE_DATABASE_EMULATOR_HOST) return undefined;
  const raw = environment.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Falta configurar FIREBASE_SERVICE_ACCOUNT_JSON en Vercel.');
  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  return cert(serviceAccount);
}

function adminApp() {
  const existing = getApps()[0];
  if (existing) return existing;
  const credential = serverCredential();
  return initializeApp({ projectId, databaseURL, ...(credential ? { credential } : {}) });
}

export const getAdminAuth = () => getAuth(adminApp());
export const getAdminDb = () => getDatabase(adminApp());
