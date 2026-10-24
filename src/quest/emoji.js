import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const FILE = path.join(path.dirname(__filename), "../data/custom_emojis.json");
const DEFAULT_EMOJIS = { list: "📋", links: "🔗", emoji_15: "✨", qdiamond: "◆", loading: "⏳", orbs: "🔮", announce: "📢", s_admin: "🛠️", online: "🟢", gift: "🎁", warn: "⚠️", arrow: "➡️", dot: "•" };
let cache = {};
let loaded = false;
async function load() { if (loaded) return; try { cache = JSON.parse(await fs.readFile(FILE, "utf8")); } catch { cache = {}; } loaded = true; }
export class EmojiStore { async getEmojis(guildId = "global") { await load(); return { ...DEFAULT_EMOJIS, ...(cache.global || {}), ...(cache[guildId] || {}) }; } async saveEmoji(key, value, guildId = "global") { if (!key || !value) return false; await load(); cache[guildId] ||= {}; cache[guildId][key] = value; await fs.mkdir(path.dirname(FILE), { recursive: true }); await fs.writeFile(FILE, JSON.stringify(cache, null, 2)); return true; } }
export const emojiStore = new EmojiStore();
export const getEmojis = (guildId = "global") => emojiStore.getEmojis(guildId);
export const saveEmoji = (key, value, guildId = "global") => emojiStore.saveEmoji(key, value, guildId);
