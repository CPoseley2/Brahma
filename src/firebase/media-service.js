const DEFAULT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export class MediaService {
  constructor(storageManager, { allowedTypes = DEFAULT_TYPES, maxBytes = 10 * 1024 * 1024 } = {}) {
    this.storageManager = storageManager; this.allowedTypes = allowedTypes; this.maxBytes = maxBytes;
  }
  validate(files) {
    return [...files].map(file => {
      if (!this.allowedTypes.includes(file.type)) throw new Error(`${file.name} is not an allowed file type.`);
      if (file.size > this.maxBytes) throw new Error(`${file.name} exceeds the ${Math.round(this.maxBytes / 1048576)} MB limit.`);
      return file;
    });
  }
  async upload(files, directory, ownerId) {
    const validFiles = this.validate(files);
    return Promise.all(validFiles.map(async file => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${directory}/${ownerId}/${crypto.randomUUID()}_${safeName}`;
      const uploaded = await this.storageManager.upload(file, path, file.type);
      return { ...uploaded, fileName: file.name };
    }));
  }
  async copy({ sourcePath, directory, ownerId, fileName, contentType }) {
    if (!sourcePath) throw new Error("The source file is unavailable.");
    if (!this.allowedTypes.includes(contentType)) throw new Error("The source file type is not supported.");
    const safeName = String(fileName || "copy").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${directory}/${ownerId}/${crypto.randomUUID()}_${safeName}`;
    const copied = await this.storageManager.copy(sourcePath, path, contentType);
    return { ...copied, fileName };
  }
  delete(path) { return this.storageManager.delete(path); }
}
