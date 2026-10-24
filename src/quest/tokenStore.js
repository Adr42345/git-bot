/** Local encrypted JSON token store; public API remains compatible with quest/link logic. */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ALGORITHM = 'aes-256-gcm';
const __filename = fileURLToPath(import.meta.url);
const STORE_PATH = path.join(path.dirname(__filename), '../data/tokens.json');
function deriveKey(secret) { return crypto.createHash('sha256').update(String(secret)).digest(); }
function encrypt(text, key) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv(ALGORITHM, key, iv); const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]); return JSON.stringify({ iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: data.toString('hex') }); }
function decrypt(stored, key) { try { const { iv, tag, data } = JSON.parse(stored); const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex')); decipher.setAuthTag(Buffer.from(tag, 'hex')); return decipher.update(Buffer.from(data, 'hex'), undefined, 'utf8') + decipher.final('utf8'); } catch { return null; } }
export class TokenStore {
    constructor(secret) {
        const primarySecret = secret || process.env.TOKEN_ENCRYPTION_SECRET || process.env.DISCORD_TOKEN || 'local-secret';
        this.key = deriveKey(primarySecret);
        this.legacyKeys = [process.env.DISCORD_TOKEN, 'local-secret']
            .filter((value) => value && value !== primarySecret)
            .map(deriveKey);
        this.records = new Map();
        this.loaded = this.loadFromDisk();
    }
    decryptRecord(record) {
        if (!record?.encryptedData) return null;
        for (const key of [this.key, ...this.legacyKeys]) {
            const value = decrypt(record.encryptedData, key);
            if (value !== null) return value;
        }
        return null;
    }
    makeCacheKey(guildId, userId, slot) { return `${guildId}_${userId}_slot_${slot}`; }
    async loadFromDisk() { try { const items = JSON.parse(await fs.readFile(STORE_PATH, 'utf8')); if (Array.isArray(items)) for (const item of items) this.records.set(this.makeCacheKey(item.guildId, item.userId, item.slot), item); } catch (error) { if (error.code !== 'ENOENT') console.error('Error loading local token store:', error.message); } }
    async ready() { await this.loaded; }
    async persist() { await fs.mkdir(path.dirname(STORE_PATH), { recursive: true }); const temp = `${STORE_PATH}.tmp`; await fs.writeFile(temp, JSON.stringify([...this.records.values()], null, 2), 'utf8'); await fs.rename(temp, STORE_PATH); }
    async getActiveSlot(guildId, userId) { await this.ready(); const records = [...this.records.values()].filter(r => r.guildId === guildId && r.userId === userId).sort((a, b) => a.slot - b.slot); const record = records.find(r => r.isActive) || records[0]; if (!record) return null; return { slot: record.slot, token: this.decryptRecord(record), username: record.username, linkedUserId: record.linkedUserId || userId, avatar: record.avatar, isActive: Boolean(record.isActive) }; }
    async getActiveToken(guildId, userId) { const active = await this.getActiveSlot(guildId, userId); return active?.token || null; }
    async getAllSlots(guildId, userId) { await this.ready(); return [...this.records.values()].filter(r => r.guildId === guildId && r.userId === userId).sort((a, b) => a.slot - b.slot).map(r => ({ slot: r.slot, username: r.username || 'Linked Account', linkedUserId: r.linkedUserId || userId, avatar: r.avatar || null, isActive: Boolean(r.isActive), linkedAt: r.linkedAt || new Date().toISOString() })); }
    async getUsersForGuild(guildId) { await this.ready(); return [...new Set([...this.records.values()].filter(r => r.guildId === guildId).map(r => r.userId))]; }
    async saveSlot({ guildId, ownerId, slot, token, linkedUserId = '', username = '', avatar = '', isActive = false, linkedAt = new Date() }) { await this.ready(); slot = Number(slot); if (!guildId || !ownerId || !Number.isInteger(slot) || slot < 1 || slot > 5 || !String(token || '').trim()) return false; const existing = [...this.records.values()].filter(r => r.guildId === guildId && r.userId === ownerId); if (existing.length === 0) isActive = true; if (isActive) for (const record of existing) record.isActive = false; this.records.set(this.makeCacheKey(guildId, ownerId, slot), { guildId, userId: ownerId, slot, encryptedData: encrypt(token.trim(), this.key), username, linkedUserId, avatar, isActive: Boolean(isActive), linkedAt, updatedAt: new Date().toISOString() }); await this.persist(); return true; }
    async removeSlot(guildId, userId, slot) { await this.ready(); const existed = this.records.delete(this.makeCacheKey(guildId, userId, Number(slot))); const remaining = [...this.records.values()].filter(r => r.guildId === guildId && r.userId === userId).sort((a, b) => a.slot - b.slot); if (remaining.length && !remaining.some(r => r.isActive)) remaining[0].isActive = true; if (existed) await this.persist(); return existed; }
    async setActiveSlot(guildId, userId, slot) { await this.ready(); let found = false; for (const record of this.records.values()) if (record.guildId === guildId && record.userId === userId) { record.isActive = record.slot === Number(slot); if (record.isActive) found = true; } if (found) await this.persist(); return found; }
    async save(guildId, userId, slot, token, username = '') { return this.saveSlot({ guildId, ownerId: userId, slot, token, username }); }
    async saveOld(userId, token) { return this.save('global', userId, 1, token); }
    get(guildId, userId, slot) { const record = this.records.get(this.makeCacheKey(guildId, userId, slot)); return record ? this.decryptRecord(record) : null; }
    getOld(userId) { return this.get('global', userId, 1); }
    getUsername(guildId, userId, slot) { return this.records.get(this.makeCacheKey(guildId, userId, slot))?.username || ''; }
    async remove(guildId, userId, slot) { return this.removeSlot(guildId, userId, slot); }
    async removeOld(userId) { return this.remove('global', userId, 1); }
    has(guildId, userId, slot) { return this.records.has(this.makeCacheKey(guildId, userId, slot)); }
    hasOld(userId) { return this.has('global', userId, 1); }
    getUserSlots(guildId, userId) { return [...this.records.values()].filter(r => r.guildId === guildId && r.userId === userId).map(r => r.slot).sort((a, b) => a - b); }
    countUserSlots(guildId, userId) { return this.getUserSlots(guildId, userId).length; }
    get size() { return this.records.size; }
}
export function createTokenStore(secret) { return new TokenStore(secret); }
export function makeTokenStore(secret) { return createTokenStore(secret); }
