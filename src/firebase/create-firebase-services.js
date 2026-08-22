import { createFirebaseClient } from "./firebase-client.js";
import { FirestoreManager } from "./firestore-manager.js";
import { AuthManager } from "./auth-manager.js";
import { FirebaseStorageManager } from "./storage-manager.js";
import { MediaService } from "./media-service.js";
import { BroadcastService } from "./broadcast-service.js";
import { MessageService } from "./message-service.js";
import { TeamHubRepository } from "./team-hub-repository.js";
import { AdminRepository } from "./admin-repository.js";

export function createFirebaseServices(teamId = import.meta.env.VITE_FIREBASE_TEAM_ID) {
  if (!teamId) throw new Error("VITE_FIREBASE_TEAM_ID is required.");
  const client = createFirebaseClient();
  const firestore = new FirestoreManager(client.db);
  const repository = new TeamHubRepository(firestore, teamId);
  const adminRepository = new AdminRepository(firestore);
  const storage = new FirebaseStorageManager(client.storage);
  return {
    ...client, firestore, repository, storage,
    auth: new AuthManager(client.auth, async uid => {
      let admin = null;
      try { admin = await adminRepository.fetchAdmin(uid); }
      catch (error) { console.warn("Club admin access is not available in this environment yet.", error); }
      return admin?.active ? { ...admin, role: "clubAdmin" } : repository.fetchMembership(uid);
    }, user => repository.acceptInvite(user)),
    adminRepository,
    media: new MediaService(storage),
    broadcasts: new BroadcastService(firestore),
    messages: new MessageService(firestore),
  };
}
