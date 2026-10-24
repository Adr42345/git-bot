// Compatibility facade: persistence is local JSON, never an external database.
export { getDatabase, getCollection, isMongoReady, connectDB } from './mongo.js';
export { getDatabase as default } from './mongo.js';
