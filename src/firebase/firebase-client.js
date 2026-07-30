import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const environment = import.meta.env || {};

export function authDomainForLocation(configuredDomain, projectId, hostname = globalThis.location?.hostname || "") {
  const firebaseHostingDomains = new Set([`${projectId}.web.app`, `${projectId}.firebaseapp.com`]);
  return firebaseHostingDomains.has(hostname) ? hostname : configuredDomain;
}

export const firebaseConfig = {
  apiKey: environment.VITE_FIREBASE_API_KEY,
  authDomain: authDomainForLocation(environment.VITE_FIREBASE_AUTH_DOMAIN, environment.VITE_FIREBASE_PROJECT_ID),
  projectId: environment.VITE_FIREBASE_PROJECT_ID,
  storageBucket: environment.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: environment.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

export function createFirebaseClient() {
  if (!isFirebaseConfigured()) throw new Error("Firebase is not configured. Copy .env.example to .env and add the web app values.");
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
}
