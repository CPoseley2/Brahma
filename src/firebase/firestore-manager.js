import {
  addDoc, arrayUnion, collection, deleteDoc, doc, documentId, getDoc, getDocs,
  limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc,
  updateDoc, where, writeBatch,
} from "firebase/firestore";

const queryOperators = {
  eq: "==", neq: "!=", lt: "<", lte: "<=", gt: ">", gte: ">=",
  arrayContains: "array-contains", arrayContainsAny: "array-contains-any",
  in: "in", notIn: "not-in",
};

export class FirestoreManager {
  constructor(db) { this.db = db; }
  collection(model, context = {}) { return collection(this.db, model.collectionPath(context)); }
  document(model, id, context = {}) { return doc(this.collection(model, context), id); }

  async save(model, value, context = {}, { merge = false } = {}) {
    const data = model.toFirestore(value);
    if (value.id) { await setDoc(this.document(model, value.id, context), data, { merge }); return value; }
    const reference = await addDoc(this.collection(model, context), data);
    return { ...value, id: reference.id };
  }
  upsert(model, value, context = {}) { return this.save(model, value, context, { merge: true }); }
  async update(model, id, fields, context = {}) { await updateDoc(this.document(model, id, context), fields); }
  async fetch(model, id, context = {}) {
    const snapshot = await getDoc(this.document(model, id, context));
    return snapshot.exists() ? model.fromFirestore(snapshot.id, snapshot.data()) : null;
  }
  async fetchAll(model, context = {}, options = {}) { return this.fetchWhere(model, [], context, options); }
  async fetchWhere(model, conditions, context = {}, options = {}) {
    const constraints = conditions.map(({ field, operator = "eq", value }) => {
      if (!(operator in queryOperators)) throw new Error(`Unsupported Firestore operator: ${operator}`);
      if (["in", "notIn", "arrayContainsAny"].includes(operator) && (!Array.isArray(value) || !value.length)) throw new Error(`${operator} requires a non-empty array.`);
      return where(field === "id" ? documentId() : field, queryOperators[operator], value);
    });
    if (options.orderBy) constraints.push(orderBy(options.orderBy.field, options.orderBy.direction || "asc"));
    if (options.limit) constraints.push(limit(options.limit));
    const snapshot = await getDocs(query(this.collection(model, context), ...constraints));
    return snapshot.docs.map(item => model.fromFirestore(item.id, item.data()));
  }
  async fetchInTransaction(transaction, model, id, context = {}) {
    const snapshot = await transaction.get(this.document(model, id, context));
    return snapshot.exists() ? model.fromFirestore(snapshot.id, snapshot.data()) : null;
  }
  setInTransaction(transaction, model, value, context = {}, { merge = false } = {}) {
    transaction.set(this.document(model, value.id, context), model.toFirestore(value), { merge });
  }
  updateInTransaction(transaction, model, id, fields, context = {}) {
    transaction.update(this.document(model, id, context), fields);
  }
  async exists(model, id, context = {}) { return (await getDoc(this.document(model, id, context))).exists(); }
  async existsWhere(model, conditions, context = {}) { return (await this.fetchWhere(model, conditions, context, { limit: 1 })).length > 0; }
  async delete(model, id, context = {}) { await deleteDoc(this.document(model, id, context)); }
  subscribe(model, conditions, context, onValue, onError) {
    const constraints = conditions.map(({ field, operator = "eq", value }) => where(field, queryOperators[operator], value));
    return onSnapshot(query(this.collection(model, context), ...constraints), snapshot => onValue(snapshot.docs.map(item => model.fromFirestore(item.id, item.data()))), onError);
  }
  async saveMultiple(entries) {
    return this.applyBatch(entries, []);
  }
  async applyBatch(entries, deletions) {
    const batch = writeBatch(this.db);
    entries.forEach(({ model, value, context = {}, merge = false }) => {
      const reference = value.id ? this.document(model, value.id, context) : doc(this.collection(model, context));
      batch.set(reference, model.toFirestore(value), { merge });
    });
    deletions.forEach(({ model, id, context = {} }) => batch.delete(this.document(model, id, context)));
    await batch.commit();
  }
  transaction(handler) { return runTransaction(this.db, transaction => handler(transaction, this)); }
}

export const firestoreValues = { arrayUnion, serverTimestamp };
