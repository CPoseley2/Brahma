export function defineFirestoreModel({ collectionPath, fromFirestore, toFirestore }) {
  if (typeof collectionPath !== "function") throw new TypeError("collectionPath must be a function.");
  return Object.freeze({
    collectionPath,
    fromFirestore: fromFirestore || ((id, data) => ({ id, ...data })),
    toFirestore: toFirestore || ((model) => {
      const { id: _id, ...data } = model;
      return data;
    }),
  });
}

export const teamModels = {
  clubAdmin: defineFirestoreModel({ collectionPath: () => "clubAdmins" }),
  coach: defineFirestoreModel({ collectionPath: () => "coaches" }),
  field: defineFirestoreModel({ collectionPath: () => "fields" }),
  budgetItem: defineFirestoreModel({ collectionPath: () => "budgetItems" }),
  gearItem: defineFirestoreModel({ collectionPath: () => "gearItems" }),
  gearDistribution: defineFirestoreModel({ collectionPath: () => "gearDistributions" }),
  scheduleScenario: defineFirestoreModel({ collectionPath: () => "scheduleScenarios" }),
  team: defineFirestoreModel({ collectionPath: () => "teams" }),
  member: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/members` }),
  invite: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/invites` }),
  family: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/families` }),
  guardian: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/guardians` }),
  player: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/players` }),
  event: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/events` }),
  session: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/sessions` }),
  volunteerSlot: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/volunteerSlots` }),
  broadcast: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/broadcasts` }),
  message: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/messages` }),
  drillCard: defineFirestoreModel({ collectionPath: ({ teamId }) => `teams/${teamId}/drillCards` }),
  sharedObservation: defineFirestoreModel({ collectionPath: ({ teamId, playerId }) => `teams/${teamId}/players/${playerId}/sharedObservations` }),
  privateObservation: defineFirestoreModel({ collectionPath: ({ teamId, playerId }) => `teams/${teamId}/players/${playerId}/privateObservations` }),
  rsvp: defineFirestoreModel({ collectionPath: ({ teamId, eventId }) => `teams/${teamId}/events/${eventId}/rsvps` }),
  eventSlot: defineFirestoreModel({ collectionPath: ({ teamId, eventId }) => `teams/${teamId}/events/${eventId}/slots` }),
};
