import { runQuestAll } from '../commands/questCommands.js';

const activeRuns = new Set();

function silentSender() {
    return async () => ({ edit: async () => true });
}

async function runForGuild(client, guild) {
    const key = guild.id;
    if (activeRuns.has(key)) {
        console.log(`[QuestAll Scheduler] skipped ${guild.name}: a run is already active`);
        return { users: 0, completed: 0, failed: 0, skipped: true };
    }

    activeRuns.add(key);
    let completed = 0;
    let failed = 0;
    let users = [];
    try {
        users = await client.tokenStore.getUsersForGuild(guild.id);
        for (const userId of users) {
            const sender = silentSender();
            const ok = await runQuestAll(guild.id, userId, client.tokenStore, sender, client.prefix || '!').catch((error) => {
                console.error(`[QuestAll Scheduler] ${guild.id}/${userId}:`, error.message);
                return false;
            });
            if (ok) completed++;
            else failed++;
        }
        console.log(`[QuestAll Scheduler] ${guild.name}: ${users.length} users, ${completed} completed, ${failed} failed`);
        return { users: users.length, completed, failed, skipped: false };
    } finally {
        activeRuns.delete(key);
    }
}

export async function runScheduledQuestAll(client, reason = 'scheduled') {
    console.log(`[QuestAll Scheduler] starting ${reason} run`);
    const totals = { guilds: 0, users: 0, completed: 0, failed: 0 };
    for (const guild of client.guilds.cache.values()) {
        const result = await runForGuild(client, guild);
        totals.guilds++;
        totals.users += result.users;
        totals.completed += result.completed;
        totals.failed += result.failed;
    }
    console.log(`[QuestAll Scheduler] ${reason} run finished: ${totals.users} users, ${totals.completed} completed, ${totals.failed} failed`);
    return totals;
}

export function startQuestAllScheduler(client) {
    const runOnStart = process.env.AUTO_QUESTALL_ON_START !== 'false';
    const dailyEnabled = process.env.AUTO_QUESTALL_DAILY !== 'false';
    const intervalHours = Math.max(1, Number(process.env.AUTO_QUESTALL_INTERVAL_HOURS) || 24);
    const intervalMs = intervalHours * 60 * 60 * 1000;

    if (runOnStart) {
        setTimeout(() => runScheduledQuestAll(client, 'startup').catch((error) => {
            console.error('[QuestAll Scheduler] startup error:', error.message);
        }), 5000);
    }

    if (dailyEnabled) {
        setInterval(() => runScheduledQuestAll(client, 'daily').catch((error) => {
            console.error('[QuestAll Scheduler] daily error:', error.message);
        }), intervalMs);
    }

    console.log(`[QuestAll Scheduler] configured: onStart=${runOnStart}, daily=${dailyEnabled}, interval=${intervalHours}h`);
}
