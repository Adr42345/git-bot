import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const STORE_PATH = path.join(path.dirname(__filename), '../data/premium_users.json');

export class PremiumStore {
    constructor() {
        this.records = new Set();
        this.loaded = this.load();
    }

    key(guildId, userId) {
        return `${guildId}:${userId}`;
    }

    async load() {
        try {
            const parsed = JSON.parse(await fs.readFile(STORE_PATH, 'utf8'));
            if (Array.isArray(parsed)) for (const item of parsed) {
                if (item?.guildId && item?.userId) this.records.add(this.key(item.guildId, item.userId));
            }
        } catch (error) {
            if (error.code !== 'ENOENT') console.error('تعذر تحميل إعدادات المستخدمين المميزين:', error.message);
        }
    }

    async ready() { await this.loaded; }

    async save() {
        await this.ready();
        await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
        const data = [...this.records].map((key) => {
            const [guildId, userId] = key.split(':');
            return { guildId, userId, updatedAt: new Date().toISOString() };
        });
        const temp = `${STORE_PATH}.tmp`;
        await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
        await fs.rename(temp, STORE_PATH);
    }

    async isPremium(guildId, userId) {
        await this.ready();
        return this.records.has(this.key(guildId, userId));
    }

    async grant(guildId, userId) {
        await this.ready();
        const key = this.key(guildId, userId);
        const changed = !this.records.has(key);
        this.records.add(key);
        if (changed) await this.save();
        return changed;
    }

    async revoke(guildId, userId) {
        await this.ready();
        const changed = this.records.delete(this.key(guildId, userId));
        if (changed) await this.save();
        return changed;
    }

    async list(guildId) {
        await this.ready();
        return [...this.records]
            .filter((key) => key.startsWith(`${guildId}:`))
            .map((key) => key.slice(`${guildId}:`.length));
    }
}
