import { teamModels } from "./firestore-model.js";

export class MessageService {
  constructor(firestoreManager) { this.firestore = firestoreManager; }

  send({ teamId, id, familyId, guardianId, playerId, body, senderUid, senderRole, senderLabel, createdAt }) {
    const recipient = guardianId ? { guardianId, playerId } : { familyId };
    return this.firestore.save(teamModels.message, {
      id, ...recipient, body, senderUid, senderRole, senderLabel,
      createdAt: createdAt || new Date().toISOString(),
    }, { teamId });
  }
}
