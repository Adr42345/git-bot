import { getAutoquestUsers } from '../quest/autoquestStore.js';
import { runAutoquestForUser } from '../commands/questCommands.js';
import { QuestClient } from '../quest/questClient.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes
const completedQuestIds = new Set(); // track already-processed quest IDs globally
const activeUserRuns = new Set();

export function startAutoquestWatcher(client) {
    console.log('  \x1b[92m●\x1b[0m \x1b[97mAutoquest watcher started\x1b[0m');

    setInterval(async () => {
        const users = getAutoquestUsers();
        if (users.length === 0) return;

        for (const userId of users) {
            for (const guild of client.guilds.cache.values()) {
            const runKey = `${guild.id}:${userId}`;
            if (activeUserRuns.has(runKey)) continue;
            activeUserRuns.add(runKey);
            try {
                const active = await client.tokenStore.getActiveSlot(guild.id, userId);
                const token = active?.token;
                if (!token) continue;

                const qc = new QuestClient(token);
                const manager = await qc.fetchQuests();
                const valid = manager.filterQuestsValid();

                const pending = [];
                for (const quest of valid) {
                    const key = `${guild.id}:${userId}:${quest.id}`;
                    if (completedQuestIds.has(key)) continue;
                    completedQuestIds.add(key);
                    pending.push(quest);
                }

                const mode = await client.settingsStore?.getAutoquestMode(guild.id, userId) || 'sequential';
                if (mode === 'parallel') {
                    await Promise.all(pending.map((quest) => runAutoquestForUser(userId, quest, client.tokenStore, client, guild.id).catch(() => {})));
                } else {
                    for (const quest of pending) {
                        await runAutoquestForUser(userId, quest, client.tokenStore, client, guild.id).catch(() => {});
                        await new Promise((resolve) => setTimeout(resolve, 1500));
                    }
                }
            } catch {
                // silently skip — token may be expired, handled inside runAutoquestForUser
            } finally {
                activeUserRuns.delete(runKey);
            }
            }
        }
    }, POLL_INTERVAL_MS);
}
