import { initializeApp } from "firebase/app";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDT1-UBdoACSWmIz8I2yvGUJvGIKfuJ8FQ",
  authDomain: "salem-1692-16b8b.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://salem-1692-16b8b-default-rtdb.firebaseio.com",
  projectId: "salem-1692-16b8b",
  storageBucket: "salem-1692-16b8b.firebasestorage.app",
  messagingSenderId: "1038421119986",
  appId: "1:1038421119986:web:5287d1283742b91ddc916b"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1");

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || globalThis.location?.hostname || '127.0.0.1';
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectDatabaseEmulator(db, emulatorHost, 9000);
  connectFunctionsEmulator(functions, emulatorHost, 5001);
}
