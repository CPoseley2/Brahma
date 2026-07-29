import { teamModels } from "./firestore-model.js";

export class BroadcastService {
  constructor(firestoreManager) { this.firestore = firestoreManager; }
  log({ teamId, id, familyIds = [], title, body, attachments = [], actionButton = null, sentByUid, sentByLabel = "Coach", sentAt }) {
    return this.firestore.save(teamModels.broadcast, {
      id, familyIds, title, body, attachments, actionButton, sentByUid, sentByLabel,
      sentAt: sentAt || new Date().toISOString(),
    }, { teamId });
  }
}
