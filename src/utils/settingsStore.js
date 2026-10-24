import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const STORE_PATH = path.join(path.dirname(__filename), '../data/user_settings.json');

export class SettingsStore {
    constructor() {
        this.records = new Map();
        this.loaded = this.load();
    }

    key(guildId, userId) { return `${guildId}:${userId}`; }

    async load() {
        try {
            const parsed = JSON.parse(await fs.readFile(STORE_PATH, 'utf8'));
            if (parsed && typeof parsed === 'object') {
                for (const [key, value] of Object.entries(parsed)) {
                    const mode = value?.autoquestMode === 'parallel' ? 'parallel' : 'sequential';
                    this.records.set(key, { autoquestMode: mode });
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') console.error('تعذر تحميل إعدادات المستخدم:', error.message);
        }
    }

    async ready() { await this.loaded; }

    async save() {
        await this.ready();
        await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
        const temp = `${STORE_PATH}.tmp`;
        await fs.writeFile(temp, JSON.stringify(Object.fromEntries(this.records), null, 2), 'utf8');
        await fs.rename(temp, STORE_PATH);
    }

    async getAutoquestMode(guildId, userId) {
        await this.ready();
        return this.records.get(this.key(guildId, userId))?.autoquestMode || 'sequential';
    }

    async setAutoquestMode(guildId, userId, mode) {
        const value = mode === 'parallel' ? 'parallel' : 'sequential';
        await this.ready();
        this.records.set(this.key(guildId, userId), { autoquestMode: value });
        await this.save();
        return value;
    }
}
