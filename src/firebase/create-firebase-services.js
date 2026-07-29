import { createFirebaseClient } from "./firebase-client.js";
import { FirestoreManager } from "./firestore-manager.js";
import { AuthManager } from "./auth-manager.js";
import { FirebaseStorageManager } from "./storage-manager.js";
import { MediaService } from "./media-service.js";
import { BroadcastService } from "./broadcast-service.js";
import { MessageService } from "./message-service.js";
import { TeamHubRepository } from "./team-hub-repository.js";

export function createFirebaseServices(teamId = import.meta.env.VITE_FIREBASE_TEAM_ID) {
  if (!teamId) throw new Error("VITE_FIREBASE_TEAM_ID is required.");
  const client = createFirebaseClient();
  const firestore = new FirestoreManager(client.db);
  const repository = new TeamHubRepository(firestore, teamId);
  const storage = new FirebaseStorageManager(client.storage);
  return {
    ...client, firestore, repository, storage,
    auth: new AuthManager(client.auth, uid => repository.fetchMembership(uid), user => repository.acceptInvite(user)),
    media: new MediaService(storage),
    broadcasts: new BroadcastService(firestore),
    messages: new MessageService(firestore),
  };
}
