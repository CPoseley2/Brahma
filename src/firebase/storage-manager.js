import { deleteObject, getBlob, getDownloadURL, ref, uploadBytes } from "firebase/storage";

export class FirebaseStorageManager {
  constructor(storage) { this.storage = storage; }
  async upload(file, path, contentType = file.type || "application/octet-stream") {
    if (!(file instanceof Blob)) throw new TypeError("upload expects a File or Blob.");
    const reference = ref(this.storage, path);
    const snapshot = await uploadBytes(reference, file, { contentType });
    return { path: snapshot.ref.fullPath, url: await getDownloadURL(snapshot.ref), contentType, size: file.size };
  }
  async copy(sourcePath, targetPath, contentType = "application/octet-stream") {
    const source = ref(this.storage, sourcePath);
    const blob = await getBlob(source);
    return this.upload(blob, targetPath, contentType);
  }
  delete(path) { return deleteObject(ref(this.storage, path)); }
}
