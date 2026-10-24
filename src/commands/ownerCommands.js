import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { OWNER_ID, PREFIX } from '../utils/config.js';
import { runQuestAll } from './questCommands.js';

function isOwner(userId) {
    return String(userId) === OWNER_ID;
}

function denied() {
    return { content: '❌ هذا الأمر مخصص لمالك البوت فقط.', flags: MessageFlags.Ephemeral };
}

function silentSender() {
    let created = false;
    return {
        send: async () => {
            created = true;
            return { edit: async () => true };
        },
        get created() { return created; },
    };
}

const activeAllUserRuns = new Set();

function runWithTimeout(task, timeoutMs = 15 * 60 * 1000) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        Promise.resolve(task).then(resolve).catch(() => resolve(false)).finally(() => clearTimeout(timer));
    });
}

function runKey(guildId) {
    return `questforallusers:${guildId}`;
}

export const questForAllUsersCmd = {
    data: new SlashCommandBuilder()
        .setName('questforallusers')
        .setDescription('تنفيذ المهام لكل المستخدمين المرتبطين في هذا السيرفر'),
    prefix: 'questforallusers',
    async execute(interaction, client) {
        if (!isOwner(interaction.user.id)) return interaction.reply(denied());
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.guild) return interaction.editReply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.' });
        const key = runKey(interaction.guild.id);
        if (activeAllUserRuns.has(key)) return interaction.editReply({ content: '⏳ التنفيذ الجماعي يعمل حالياً في هذا السيرفر.' });
        activeAllUserRuns.add(key);
        let users = [];
        let completed = 0;
        let failed = 0;
        try {
            users = await client.tokenStore.getUsersForGuild(interaction.guild.id);
            await interaction.editReply({ content: `⏳ بدأ التنفيذ الجماعي لـ **${users.length}** مستخدم. راح يتم تحديث هذه الرسالة بعد كل مستخدم.` });
            for (let index = 0; index < users.length; index++) {
                const userId = users[index];
                const sender = silentSender();
                const ok = await runWithTimeout(runQuestAll(interaction.guild.id, userId, client.tokenStore, sender.send, PREFIX).catch(() => false));
                if (ok) completed++;
                else failed++;
                await interaction.editReply({ content: `⏳ تقدم التنفيذ الجماعي: **${index + 1}/${users.length}**\n✅ اكتملت: **${completed}** · ❌ لم تكتمل: **${failed}**` }).catch(() => {});
            }
            await interaction.editReply({ content: `✅ انتهى التنفيذ الجماعي.\nالمستخدمون: **${users.length}** · اكتملت: **${completed}** · لم تكتمل: **${failed}**`, flags: MessageFlags.Ephemeral });
        } finally {
            activeAllUserRuns.delete(key);
        }
    },
    async prefixExecute(message, _args, client) {
        if (!isOwner(message.author.id)) return message.reply('❌ هذا الأمر مخصص لمالك البوت فقط.');
        if (!message.guild) return message.reply('❌ هذا الأمر يعمل داخل السيرفر فقط.');
        const key = runKey(message.guild.id);
        if (activeAllUserRuns.has(key)) return message.reply('⏳ التنفيذ الجماعي يعمل حالياً في هذا السيرفر.');
        activeAllUserRuns.add(key);
        let users = [];
        let completed = 0;
        let failed = 0;
        try {
            users = await client.tokenStore.getUsersForGuild(message.guild.id);
            const statusMessage = await message.reply(`⏳ بدأ التنفيذ الجماعي لـ **${users.length}** مستخدم. انتظر، راح يتم تحديث هذه الرسالة.`);
            for (let index = 0; index < users.length; index++) {
                const userId = users[index];
                const sender = silentSender();
                const ok = await runWithTimeout(runQuestAll(message.guild.id, userId, client.tokenStore, sender.send, PREFIX).catch(() => false));
                if (ok) completed++;
                else failed++;
                await statusMessage.edit(`⏳ تقدم التنفيذ الجماعي: **${index + 1}/${users.length}**\n✅ اكتملت: **${completed}** · ❌ لم تكتمل: **${failed}**`).catch(() => {});
            }
            await statusMessage.edit(`✅ انتهى التنفيذ الجماعي. المستخدمون: ${users.length} · اكتملت: ${completed} · لم تكتمل: ${failed}`).catch(() => {});
        } finally {
            activeAllUserRuns.delete(key);
        }
    },
};

export const premiumSettingsCmd = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('إدارة المستخدمين المميزين - للمالك فقط')
        .addSubcommand((sub) => sub.setName('grant').setDescription('منح صلاحية مميزة').addUserOption((o) => o.setName('user').setDescription('المستخدم').setRequired(true)))
        .addSubcommand((sub) => sub.setName('revoke').setDescription('إزالة الصلاحية المميزة').addUserOption((o) => o.setName('user').setDescription('المستخدم').setRequired(true)))
        .addSubcommand((sub) => sub.setName('list').setDescription('عرض المستخدمين المميزين')),
    prefix: 'premium',
    async execute(interaction, client) {
        if (!isOwner(interaction.user.id)) return interaction.reply(denied());
        const action = interaction.options.getSubcommand();
        if (action === 'list') {
            const users = await client.premiumStore.list(interaction.guild.id);
            return interaction.reply({ content: users.length ? `⭐ المستخدمون المميزون:\n${users.map((id) => `<@${id}>`).join('\n')}` : 'لا يوجد مستخدمون مميزون حالياً.', flags: MessageFlags.Ephemeral });
        }
        const user = interaction.options.getUser('user');
        const changed = action === 'grant'
            ? await client.premiumStore.grant(interaction.guild.id, user.id)
            : await client.premiumStore.revoke(interaction.guild.id, user.id);
        const text = action === 'grant'
            ? (changed ? `⭐ تم منح <@${user.id}> صلاحية مميزة.` : 'المستخدم مميز مسبقاً.')
            : (changed ? `✅ تم إزالة الصلاحية المميزة من <@${user.id}>.` : 'المستخدم ليس ضمن القائمة المميزة.');
        return interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    },
    async prefixExecute(message, args, client) {
        if (!isOwner(message.author.id)) return message.reply('❌ هذا الأمر مخصص لمالك البوت فقط.');
        const action = String(args[0] || '').toLowerCase();
        if (action === 'list') {
            const users = await client.premiumStore.list(message.guild.id);
            return message.reply(users.length ? `⭐ المستخدمون المميزون:\n${users.map((id) => `<@${id}>`).join('\n')}` : 'لا يوجد مستخدمون مميزون حالياً.');
        }
        const user = message.mentions.users.first();
        if (!user || !['grant', 'revoke'].includes(action)) return message.reply(`الاستخدام: ${PREFIX}premium grant @user أو ${PREFIX}premium revoke @user`);
        const changed = action === 'grant'
            ? await client.premiumStore.grant(message.guild.id, user.id)
            : await client.premiumStore.revoke(message.guild.id, user.id);
        return message.reply(action === 'grant'
            ? (changed ? `⭐ تم منح <@${user.id}> صلاحية مميزة.` : 'المستخدم مميز مسبقاً.')
            : (changed ? `✅ تم إزالة الصلاحية المميزة من <@${user.id}>.` : 'المستخدم ليس ضمن القائمة المميزة.'));
    },
};
