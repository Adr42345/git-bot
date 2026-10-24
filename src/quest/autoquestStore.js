/**
 * autoquestStore.js - JSON Based + Booster Lock 15 Invite OR 1 Boost
 * Location: src/quest/autoquestStore.js
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getRoles } from './roleStore.js';

const AUTOQUEST_FILE = path.join(process.cwd(), 'data', 'autoquest.json');

function ensureDirectory() {
    try {
        const dir = path.dirname(AUTOQUEST_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(AUTOQUEST_FILE)) fs.writeFileSync(AUTOQUEST_FILE, JSON.stringify([], null, 2));
    } catch {}
}

function load() {
    try {
        ensureDirectory();
        if (!fs.existsSync(AUTOQUEST_FILE)) return [];
        const raw = JSON.parse(fs.readFileSync(AUTOQUEST_FILE, 'utf-8'));
        return Array.isArray(raw) ? raw : [];
    } catch { return []; }
}

function save(data) {
    try { ensureDirectory(); fs.writeFileSync(AUTOQUEST_FILE, JSON.stringify(data, null, 2)); } catch {}
}

// ── Booster Check - 15 Invite OR 1 Boost = Bypass ──────────────────────────
export async function isBooster(member) { return Boolean(member); }
export async function getLockMessageForAutoquest() { return { title: 'Autoquest unavailable', desc: 'Autoquest is available locally without premium restrictions.' }; }
export async function canUseAutoquest(member) { return member ? { allowed: true } : { allowed: false, lock: await getLockMessageForAutoquest() }; }
// ── JSON Storage System ────────────────────────────────────────────────────
export function enableAutoquest(userId) {
    const data = load();
    if (data.includes(userId)) return false;
    data.push(userId);
    save(data);
    return true;
}

export function disableAutoquest(userId) {
    const data = load();
    const idx = data.indexOf(userId);
    if (idx === -1) return false;
    data.splice(idx, 1);
    save(data);
    return true;
}

export function isAutoquestEnabled(userId) { return load().includes(userId); }
export function getAutoquestUsers() { return load(); }
export function getAutoquestUserCount() { return load().length; }
