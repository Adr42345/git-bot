
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local database directory: src/data/
const DATA_DIR = path.join(__dirname, '..', 'data');

let databaseReady = false;
let databasePromise = null;

const collections = new Map();

function clone(value) {
    return value === undefined
        ? undefined
        : JSON.parse(JSON.stringify(value));
}

function matches(document, query = {}) {
    return Object.entries(query).every(([key, value]) => {
        const actual = document[key];

        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value)
        ) {
            if ('$in' in value) {
                return value.$in.includes(actual);
            }

            if ('$ne' in value) {
                return actual !== value.$ne;
            }

            if ('$exists' in value) {
                return (actual !== undefined) === value.$exists;
            }
        }

        return actual === value;
    });
}

function createCollection(name) {
    const filePath = path.join(DATA_DIR, `${name}.json`);
    let documents = [];
    let writeQueue = Promise.resolve();

    async function save() {
        writeQueue = writeQueue.then(async () => {
            await fs.mkdir(DATA_DIR, { recursive: true });

            const temporaryPath = `${filePath}.tmp`;

            await fs.writeFile(
                temporaryPath,
                JSON.stringify(documents, null, 2),
                'utf8'
            );

            await fs.rename(temporaryPath, filePath);
        });

        return writeQueue;
    }

    async function load() {
        await fs.mkdir(DATA_DIR, { recursive: true });

        try {
            const contents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(contents);

            documents = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }

            documents = [];
            await save();
        }
    }

    const collection = {
        async find(query = {}) {
            return {
                toArray: async () =>
                    clone(documents.filter(doc => matches(doc, query))),
            };
        },

        async findOne(query = {}) {
            const document = documents.find(doc => matches(doc, query));
            return clone(document || null);
        },

        async insertOne(document) {
            const inserted = {
                ...clone(document),
                _id: document._id || crypto.randomUUID(),
            };

            documents.push(inserted);
            await save();

            return {
                acknowledged: true,
                insertedId: inserted._id,
            };
        },

        async insertMany(items) {
            const insertedIds = {};

            for (let i = 0; i < items.length; i++) {
                const inserted = {
                    ...clone(items[i]),
                    _id: items[i]._id || crypto.randomUUID(),
                };

                documents.push(inserted);
                insertedIds[i] = inserted._id;
            }

            await save();

            return {
                acknowledged: true,
                insertedCount: items.length,
                insertedIds,
            };
        },

        async updateOne(query, update, options = {}) {
            let index = documents.findIndex(doc => matches(doc, query));

            if (index === -1 && options.upsert) {
                const base = {};

                for (const [key, value] of Object.entries(query)) {
                    if (
                        !value ||
                        typeof value !== 'object' ||
                        Array.isArray(value)
                    ) {
                        base[key] = value;
                    }
                }

                documents.push({
                    ...base,
                    _id: crypto.randomUUID(),
                });

                index = documents.length - 1;
            }

            if (index === -1) {
                return {
                    acknowledged: true,
                    matchedCount: 0,
                    modifiedCount: 0,
                };
            }

            const before = clone(documents[index]);
            const changes = update.$set || update;

            documents[index] = {
                ...documents[index],
                ...clone(changes),
            };

            if (update.$unset) {
                for (const key of Object.keys(update.$unset)) {
                    delete documents[index][key];
                }
            }

            await save();

            return {
                acknowledged: true,
                matchedCount: before ? 1 : 0,
                modifiedCount: 1,
                upsertedId: before ? null : documents[index]._id,
            };
        },

        async deleteOne(query = {}) {
            const index = documents.findIndex(doc => matches(doc, query));

            if (index === -1) {
                return {
                    acknowledged: true,
                    deletedCount: 0,
                };
            }

            documents.splice(index, 1);
            await save();

            return {
                acknowledged: true,
                deletedCount: 1,
            };
        },

        async deleteMany(query = {}) {
            const originalLength = documents.length;

            documents = documents.filter(doc => !matches(doc, query));

            const deletedCount = originalLength - documents.length;

            if (deletedCount > 0) {
                await save();
            }

            return {
                acknowledged: true,
                deletedCount,
            };
        },

        async countDocuments(query = {}) {
            return documents.filter(doc => matches(doc, query)).length;
        },

        async createIndex() {
            // No indexes are needed for this local JSON implementation.
            return 'local-json-index';
        },
    };

    return load().then(() => collection);
}

async function initializeDatabase() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    databaseReady = true;

    console.log(`📦 Local JSON database ready: ${DATA_DIR}`);

    return {
        collection(name) {
            if (!collections.has(name)) {
                const pending = createCollection(name);
                collections.set(name, pending);
            }

            return collections.get(name);
        },
    };
}

export async function getDatabase() {
    if (!databasePromise) {
        databasePromise = initializeDatabase().catch(error => {
            databasePromise = null;
            databaseReady = false;
            throw error;
        });
    }

    return databasePromise;
}

export async function getCollection(name) {
    const db = await getDatabase();
    return db.collection(name);
}

export function isMongoReady() {
    // Kept for compatibility with existing imports.
    return databaseReady;
}

export const connectDB = getDatabase;
export default getDatabase;
