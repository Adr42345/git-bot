/**
 * questCommands.js - QuestAll, QuestList, TokenCheck, AutoQuest Runner Support, Live % Tracker & 'q' Shortcut
 * Location: src/commands/questCommands.js
 */

import {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    SectionBuilder, ThumbnailBuilder, MessageFlags, SlashCommandBuilder
} from 'discord.js';
import { QuestClient } from '../quest/questClient.js';
import { disableAutoquest } from '../quest/autoquestStore.js';
import { PREFIX } from '../utils/config.js';

// ── Helper: Get active token for user from 5-Slot Store ────────────────────
async function getActiveToken(guildId, userId, tokenStore) {
    if (!tokenStore) return null;
    const active = await tokenStore.getActiveSlot(guildId, userId);
    if (!active) return null;
    return active.token || await tokenStore.get(guildId, userId, active.slot);
}

// ── Helper: Safe Thumbnail Asset Extractor ────────────────────────────────
function getThumbUrl(cfg) {
    const appId = cfg?.application?.id;
    const assets = cfg?.assets;
    if (!appId || !assets) return null;

    const assetKey = assets.game_tile || assets.hero || assets.quest_bar || assets.card || Object.values(assets)[0];
    if (!assetKey) return null;

    return `https://cdn.discordapp.com/app-assets/${appId}/quest-assets/${assetKey}.png`;
}

// ── UI Cards ───────────────────────────────────────────────────────────────

function buildLinkPrompt(prefix) {
    const c = new ContainerBuilder().setAccentColor(0xFEE75C);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 🔗 يلزم ربط الحساب\nاربط حسابك أولاً عشان تستخدم أوامر المهام.\n\nاستخدم \`${prefix}link\` لفتح نموذج الربط.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildNoQuestsCard() {
    const c = new ContainerBuilder().setAccentColor(0x4F545C);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 🔍 ما فيه مهام متاحة\nما فيه مهام نشطة أو غير مكتملة حالياً على الحساب المرتبط.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildExpiredTokenCard(prefix) {
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ❌ انتهت صلاحية الحساب\nتم رفض رمز الحساب من ديسكورد، غالباً انتهت صلاحيته.\n\nتم حذف الحساب من الخانة الحالية. اربطه من جديد باستخدام \`${prefix}link\`.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildErrorCard(err, prefix) {
    const msg = err?.message ?? String(err);
    const is401 = msg.includes('401');
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            is401
                ? `# ❌ رمز الحساب غير صالح أو منتهي\nاربط حسابك من جديد باستخدام \`${prefix}link\`.`
                : `# ❌ صار خطأ\n${msg.slice(0, 800)}`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildQuestInfoCard(quest, phase, claimed = 0, failReason = '', percent = 0) {
    const cfg = quest?.config ?? {};
    const msgs = cfg.messages ?? {};
    const thumbUrl = getThumbUrl(cfg);

    const TASK_META = {
        PLAY_ON_DESKTOP:       { icon: '🖥️', label: 'Play on Desktop' },
        WATCH_VIDEO:           { icon: '🎬', label: 'Watch Video' },
        STREAM_ON_DESKTOP:     { icon: '📺', label: 'Stream on Desktop' },
        PLAY_ACTIVITY:         { icon: '🎮', label: 'Play Activity' },
        WATCH_VIDEO_ON_MOBILE: { icon: '📱', label: 'Watch Video on Mobile' },
    };

    const taskLines = Object.entries((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {}).map(([type, task]) => {
        const meta = TASK_META[type] ?? { icon: '⚙️', label: type };
        let dur = '';
        if (type === 'PLAY_ON_DESKTOP' || type === 'STREAM_ON_DESKTOP') {
            dur = `  •  **${Math.ceil(task.target / 60)} min**`;
        } else if (type === 'WATCH_VIDEO' || type === 'WATCH_VIDEO_ON_MOBILE') {
            const s = task.target;
            dur = s >= 60 ? `  •  **${Math.ceil(s / 60)} min**` : `  •  **${s}s**`;
        }
        return `${meta.icon}${meta.label}${dur}${phase === 'done' ? '  ✅' : ''}`;
    });

    const rewardLines = (cfg.rewards_config?.rewards ?? []).map((r) => {
        let line = `**${r.messages?.name ?? 'مكافأة'}**`;
        if (r.orb_quantity) line += `  ✦ *(${r.orb_quantity} Orbs)*`;
        else if (r.quantity) line += `  *(${r.quantity}d Nitro)*`;
        return line;
    });

    const expiryMs = cfg.expires_at ? new Date(cfg.expires_at).getTime() : NaN;
    const expiresEpoch = Number.isFinite(expiryMs) ? Math.floor(expiryMs / 1000) : 0;
    const daysLeft = Number.isFinite(expiryMs) ? Math.max(0, Math.ceil((expiryMs - Date.now()) / 86400000)) : null;

    // Dynamic Live Progress Bar & % Renderer (10 Blocks)
    const currentPercent = Math.min(100, Math.max(0, Math.floor(percent)));
    const filledBlocks = Math.floor(currentPercent / 10);
    const emptyBlocks = 10 - filledBlocks;
    const progressBar = '`' + '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks) + '`' + `  **${currentPercent}%**`;

    const PHASE = {
        starting: { color: 0x5865F2, title: '⚙️  جاري تنفيذ المهمة...',  bar: progressBar + '  —  *جاري التنفيذ...*' },
        done:     { color: 0x57F287, title: '✅  اكتملت المهمة!',    bar: '`██████████`  **100%**' },
        failed:   { color: 0xED4245, title: '❌  فشلت المهمة',       bar: '' },
    };

    const p = PHASE[phase];
    const progressText = phase === 'failed' && failReason
        ? `\`░░░░░░░░░░\`  **0%**\n\`\`\`\n${failReason.slice(0, 300)}\n\`\`\``
        : p.bar;

    const footerNote = phase === 'done' && claimed > 0
        ? `-# 🎁 ${claimed} reward(s) claimed`
        : phase === 'starting'
        ? `-# بوت المهام • انتظر شوي...`
        : phase === 'failed'
        ? `-# تحتاج هذه المهمة تنفيذها يدوياً من تطبيق ديسكورد`
        : '';

    const c = new ContainerBuilder().setAccentColor(p.color);
    const section = new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${p.title}\n### ${msgs.quest_name ?? 'مهمة ديسكورد'}\n*${msgs.game_title ?? 'لعبة غير معروفة'}*  •  ${msgs.game_publisher ?? 'ناشر غير معروف'}`,
        )
    );

    if (thumbUrl) {
        section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbUrl));
    }

    c.addSectionComponents(section);
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `📋 **المهمة**\n${taskLines.join('\n') || '*مهمة غير معروفة*'}\n\n` +
            `📅 **تنتهي**  ${expiresEpoch ? `<t:${expiresEpoch}:R>  *(${daysLeft}d left)*` : '*Unknown*'}\n\n` +
            `📊 **التقدم**\n${progressText}\n\n` +
            `🎁 **المكافأة**\n${rewardLines.join('\n') || '*ما فيه مكافآت مسجلة*'}`,
        ),
    );

    if (footerNote) {
        c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerNote));
    }

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

// ── Quest Runners Logic ────────────────────────────────────────────────    

function buildQuestAllProgressCard(quests, states, phase = 'running', notice = '') {
    const color = phase === 'done' ? 0x57F287 : phase === 'error' ? 0xED4245 : 0x5865F2;
    const title = phase === 'done' ? '✅ اكتملت مجموعة المهام' : phase === 'error' ? '❌ خطأ في مجموعة المهام' : '⚙️ جاري تنفيذ المهام';
    const completedCount = states.filter((state) => state.phase === 'done').length;
    const failedCount = states.filter((state) => state.phase === 'failed').length;
    const runningCount = states.filter((state) => state.phase === 'running').length;
    const lines = quests.slice(0, 20).map((quest, index) => {
        const name = String(quest.config?.messages?.quest_name || quest.id || `Quest ${index + 1}`).slice(0, 120);
        const game = String(quest.config?.messages?.game_title || 'مهمة ديسكورد').slice(0, 80);
        const state = states[index] || { phase: 'queued', percent: 0 };
        const icon = state.phase === 'done' ? '✅' : state.phase === 'failed' ? '❌' : state.phase === 'running' ? '⚙️' : '⏳';
        const percent = Math.max(0, Math.min(100, Math.floor(state.percent || 0)));
        const bar = '`' + '█'.repeat(Math.floor(percent / 10)) + '░'.repeat(10 - Math.floor(percent / 10)) + '`';
        const detail = state.reason ? ` — ${String(state.reason).slice(0, 120)}` : '';
        return `${icon} **${name}** · *${game}*\n${bar} **${percent}%**${detail}`;
    });
    if (quests.length > 20) lines.push(`…and ${quests.length - 20} more quest(s).`);
    const container = new ContainerBuilder().setAccentColor(color);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title}\n${notice ? `${notice}\n\n` : ''}**${quests.length} quest(s)** · ✅ ${completedCount} complete · ⚙️ ${runningCount} active · ❌ ${failedCount} failed\n-# Updates are private to you`));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n') || 'ما فيه مهام لعرضها.'));
    return { components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

export async function runQuestAll(guildId, userId, tokenStore, send, prefix) {
    const token = await getActiveToken(guildId, userId, tokenStore);
    if (!token) { await send({ ...buildLinkPrompt(prefix), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }); return false; }

    const qc = new QuestClient(token);
    try {
        const manager = await qc.fetchQuests();
        const valid = manager.filterQuestsValid();
        if (valid.length === 0) { await send({ ...buildNoQuestsCard(), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }); return false; }

        const states = valid.map(() => ({ phase: 'queued', percent: 0 }));
        const progressMsg = await send(buildQuestAllProgressCard(valid, states));
        if (!progressMsg || typeof progressMsg.edit !== 'function') throw new Error('تعذر إنشاء رسالة تقدم المهام الخاصة.');
        let editQueue = Promise.resolve();
        const updateCard = (notice = '') => {
            editQueue = editQueue.then(() => progressMsg.edit(buildQuestAllProgressCard(valid, states, 'running', notice))).catch(() => {});
            return editQueue;
        };
        const questLogs = valid.map(() => []);

        const questResults = await Promise.allSettled(
            valid.map((quest, i) => {
                let lastPct = -1;
                states[i].phase = 'running';
                updateCard();
                const onProgress = async (done, total) => {
                    const pct = total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0;
                    states[i].percent = pct;
                    if (pct >= lastPct + 3 || pct === 100) {
                        lastPct = pct;
                        await updateCard();
                    }
                };
                const log = (m) => { console.log(m); questLogs[i].push(m); };
                return manager.doingQuest(quest, log, onProgress);
            }),
        );

        const completed = valid.filter((_, i) => questResults[i].status === 'fulfilled' && questResults[i].value === true);
        const skipped = valid.filter((_, i) => questResults[i].status === 'rejected' || (questResults[i].status === 'fulfilled' && questResults[i].value === false));
        for (const q of skipped) {
            const idx = valid.indexOf(q);
            const failLogs = questLogs[idx].filter(l => l.startsWith('[FAIL]'));
            states[idx] = {
                phase: 'failed', percent: 0,
                reason: questResults[idx].status === 'rejected'
                    ? questResults[idx].reason?.message ?? 'خطأ غير معروف'
                    : failLogs.slice(-2).join('\n') || questLogs[idx].slice(-3).join('\n') || 'تعذر تنفيذها تلقائياً.'
            };
        }
        await updateCard();

        if (completed.length === 0) {
            await progressMsg.edit(buildQuestAllProgressCard(valid, states, 'done', 'ما اكتملت أي مهمة تلقائياً. بعض أنواع المهام تحتاج تطبيق ديسكورد على الكمبيوتر أو الجوال.')).catch(() => {});
            return false;
        }

        let totalClaimed = 0;
        for (const q of completed) totalClaimed += await manager.claimRewards(console.log, q.id).catch(() => 0);
        for (const q of completed) {
            const idx = valid.indexOf(q);
            states[idx] = { phase: 'done', percent: 100, reason: totalClaimed > 0 ? 'تمت معالجة استلام المكافأة' : 'مكتملة' };
        }
        await progressMsg.edit(buildQuestAllProgressCard(valid, states, 'done', `اكتملت ${completed.length}/${valid.length} مهمة. تم استلام ${totalClaimed} مكافأة.`)).catch(() => {});
        return true;
    } catch (err) {
        const msg = err?.message ?? String(err);
        if (msg.includes('401')) {
            const active = await tokenStore.getActiveSlot(guildId, userId);
            if (active) await tokenStore.removeSlot(guildId, userId, active.slot);
            disableAutoquest(userId);
            await send({ ...buildExpiredTokenCard(prefix), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
        } else {
            await send({ ...buildErrorCard(err, prefix), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
        }
        return false;
    }
}

function buildQuestListCard(quests) {
    const rows = quests.slice(0, 20).map((q) => {
        const cfg = q.config || {};
        const msgs = cfg.messages || {};
        const status = q.isCompleted() ? '✅ مكتملة'
            : q.isExpired() ? '🔴 منتهية'
            : q.isEnrolledQuest() ? '⏳ قيد التنفيذ'
            : '🔵 متاحة';
        const expires = cfg.expires_at ? Math.floor(new Date(cfg.expires_at).getTime() / 1000) : 0;
        const expiry = expires > 0 ? ` · <t:${expires}:R>` : '';
        const tasks = Object.keys((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {})
            .map((type) => type.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()))
            .join(', ') || 'Unknown task';
        const rewards = (cfg.rewards_config?.rewards || []).map((r) => r.messages?.name || 'مكافأة').join(', ') || 'ما فيه مكافآت';
        return `### ${status} · ${msgs.quest_name || q.id}\n*${msgs.game_title || 'مهمة ديسكورد'}*${expiry}\n📋 ${tasks}\n🎁 ${rewards}`;
    });
    if (quests.length > 20) rows.push(`-# …and **${quests.length - 20}** more quest(s) not shown.`);
    const c = new ContainerBuilder().setAccentColor(0x5865F2);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 📋 قائمة المهام\n**${quests.length} مهمة** · هذه القائمة ظاهرة لك فقط`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(rows.join('\n\n') || 'ما فيه مهام متاحة.'));
    return { components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

function expiredMoreThanThreeMonthsAgo(quest) {
    const expiresAt = quest?.config?.expires_at;
    const expiryMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
    return Number.isFinite(expiryMs) && Date.now() - expiryMs > 90 * 24 * 60 * 60 * 1000;
}

async function runQuestList(guildId, userId, tokenStore, send, prefix) {
    const token = await getActiveToken(guildId, userId, tokenStore);
    if (!token) { await send({ ...buildLinkPrompt(prefix), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }); return; }
    try {
        const manager = await new QuestClient(token).fetchQuests();
        const all = manager.list().filter((quest) => !expiredMoreThanThreeMonthsAgo(quest));
        if (all.length === 0) { await send({ ...buildNoQuestsCard(), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }); return; }
        await send(buildQuestListCard(all));
    } catch (err) {
        await send({ ...buildErrorCard(err, prefix), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
    }
}

async function runTokenCheck(guildId, userId, tokenStore, replyFn, prefix) {
    const token = await getActiveToken(guildId, userId, tokenStore);
    if (!token) {
        const c = new ContainerBuilder().setAccentColor(0xFEE75C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ما فيه حساب مرتبط\nما عندك حساب نشط. استخدم \`${prefix}link\` لربط حسابك.`));
        await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
        return;
    }

    let valid = false, accountName = '';
    try {
        const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: token } });
        valid = res.ok;
        if (res.ok) {
            const data = await res.json();
            accountName = data.global_name || data.username || '';
        }
    } catch { valid = false; }

    const c = new ContainerBuilder().setAccentColor(valid ? 0x57F287 : 0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            valid
                ? `# ✅ رمز الحساب صالح\nالحساب النشط مرتبط باسم **"${accountName}"**.\n\nالحساب النشط يعمل بشكل صحيح.`
                : `# ❌ رمز الحساب غير صالح أو منتهي\nديسكورد رفض رمز الحساب النشط.\nاستخدم \`${prefix}link\` لربط الحساب من جديد.`,
        ),
    );
    await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
    if (!valid) {
        const active = await tokenStore.getActiveSlot(guildId, userId);
        if (active) await tokenStore.removeSlot(guildId, userId, active.slot);
    }
}

// ── Exports ────────────────────────────────────────────────────────────────

export const questAllCmd = {
    data: new SlashCommandBuilder().setName('questall').setDescription('تنفيذ جميع المهام المتاحة'),
    prefix: 'questall',
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await runQuestAll(interaction.guild.id, interaction.user.id, client.tokenStore, (opts) => interaction.editReply(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        const sendPrivate = async (opts) => {
            try {
                const dm = await message.author.createDM();
                return await dm.send(opts);
            } catch {
                return message.reply({ ...opts, content: `${opts.content || ''}
⚠️ Could not open a private DM; this fallback is visible in the channel.` });
            }
        };
        await runQuestAll(message.guild.id, message.author.id, client.tokenStore, sendPrivate, PREFIX);
    },
};

export const qCmd = {
    data: new SlashCommandBuilder().setName('q').setDescription('اختصار لتنفيذ جميع المهام المتاحة'),
    prefix: 'q',
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await runQuestAll(interaction.guild.id, interaction.user.id, client.tokenStore, (opts) => interaction.editReply(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        const sendPrivate = async (opts) => {
            try {
                const dm = await message.author.createDM();
                return await dm.send(opts);
            } catch {
                return message.reply({ ...opts, content: `${opts.content || ''}
⚠️ Could not open a private DM; this fallback is visible in the channel.` });
            }
        };
        await runQuestAll(message.guild.id, message.author.id, client.tokenStore, sendPrivate, PREFIX);
    },
};

export const questListCmd = {
    data: new SlashCommandBuilder().setName('questlist').setDescription('عرض جميع المهام وحالتها'),
    prefix: 'questlist',
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await runQuestList(interaction.guild.id, interaction.user.id, client.tokenStore, (opts) => interaction.editReply(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        const sendPrivate = async (opts) => {
            try {
                const dm = await message.author.createDM();
                return await dm.send(opts);
            } catch {
                return message.reply({ ...opts, content: `${opts.content || ''}\n⚠️ Could not open a private DM; this fallback is visible in the channel.` });
            }
        };
        await runQuestList(message.guild.id, message.author.id, client.tokenStore, sendPrivate, PREFIX);
    },
};

export const tokenCheckCmd = {
    data: new SlashCommandBuilder().setName('tokencheck').setDescription('التحقق من صلاحية رمز الحساب المحفوظ'),
    prefix: 'tokencheck',
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await runTokenCheck(interaction.guild.id, interaction.user.id, client.tokenStore, (opts) => interaction.editReply(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        await runTokenCheck(message.guild.id, message.author.id, client.tokenStore, (opts) => message.reply(opts), PREFIX);
    },
};

export async function runAutoquestForUser(userId, quest, tokenStore, discordClient, guildId) {
    const active = await tokenStore.getActiveSlot(guildId, userId);
    if (!active) { disableAutoquest(userId); return; }
    const token = active.token || await tokenStore.get(guildId, userId, active.slot);
    if (!token) { disableAutoquest(userId); return; }

    const { QuestClient: QC } = await import('../quest/questClient.js');
    const { Quest: Q } = await import('../quest/quest.js');
    const qc = new QC(token);
    const logs = [];
    const log = (m) => { console.log(`[AutoQuest:${userId}]`, m); logs.push(m); };

    try {
        const manager = await qc.fetchQuests();
        let live = manager.get(quest.id);
        if (!live) {
            live = Q.create({ id: quest.id, config: quest.config, user_status: null, targeted_content: quest.targetedContent, preview: quest.preview });
        }
        if (live.isCompleted() || live.isExpired()) return;

        await manager.doingQuest(live, log);

        let claimManager = manager;
        try { claimManager = await qc.fetchQuests(); } catch { if (!manager.hasQuest(live.id)) manager.upsert(live); }

        const claimed = await claimManager.claimRewards(log, live.id).catch(() => 0);

        try {
            const user = await discordClient.users.fetch(userId);
            const dm = await user.createDM();
            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# 🤖 اكتملت المهمة تلقائياً!\n**${live.config.messages.quest_name}** تم تنفيذها تلقائياً على حسابك النشط.\n${claimed > 0 ? `🎁 **${claimed}** مكافأة تم استلامها.\n` : ''}\nاستخدم \`${PREFIX}autoquest\` لإيقاف التنفيذ التلقائي.`,
                ),
            );
            await dm.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
        } catch {}

    } catch (err) {
        const msg = err?.message ?? String(err);
        console.error(`[AutoQuest:${userId}] Error:`, msg);
        if (msg.includes('401')) {
            await tokenStore.removeSlot(guildId, userId, active.slot);
            disableAutoquest(userId);
            try {
                const user = await discordClient.users.fetch(userId);
                const dm = await user.createDM();
                const c = new ContainerBuilder().setAccentColor(0xED4245);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🤖 تم إيقاف التنفيذ التلقائي\nانتهت صلاحية الحساب النشط. استخدم \`${PREFIX}link\` to re-configure slots.`));
                await dm.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
            } catch {}
        }
    }
}
