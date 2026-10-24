import {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags,
} from 'discord.js';
import { PREFIX, OWNER_ID } from '../utils/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('عرض جميع الأوامر المتاحة / Show all available commands'),
    prefix: 'help',

    async execute(interaction) {
        const language = await interaction.client.languageStore?.get(interaction.guildId, interaction.user.id) || 'ar';
        await interaction.reply(await buildHelp(interaction.user, interaction.client, language));
    },

    async prefixExecute(message, _args, client) {
        const language = await client.languageStore?.get(message.guild.id, message.author.id) || 'ar';
        await message.reply(await buildHelp(message.author, client, language));
    },
};

export async function buildHelp(user, client, language = 'ar') {
    const english = language === 'en';
    const avatar = user.displayAvatarURL({ size: 128, extension: 'png' });
    const botAvatar = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    const c = new ContainerBuilder().setAccentColor(0x5865F2);
    const text = english ? {
        title: '# 🤖 Quest Bot', greeting: `-# Hey **${user.username}**, here is everything available to you`, account: '🔗 **Account**',
        link: 'Link your Discord account', unlink: 'Remove your saved account', check: 'Check account validity', quests: '🎮 **Quests**',
        one: 'Pick and complete one quest', all: 'Complete all quests at once', list: 'View all quests and their status', auto: 'Auto-complete new quests',
        tools: '🛠️ **Tools**', ping: 'Check bot latency', help: "You're already here", languageCmd: 'Change your language', settingsCmd: 'AutoQuest execution settings', owner: '👑 **Owner Commands**',
        allUsers: 'Run quests for every linked user', grant: 'Grant premium access', revoke: 'Revoke premium access', premiumList: 'List premium users',
        servers: `Serving **${client.guilds.cache.size}** server(s) · Prefix:`, language: 'Language:',
    } : {
        title: '# 🤖 بوت المهام', greeting: `-# هلا **${user.username}**، هذه كل الخدمات المتاحة لك`, account: '🔗 **الحساب**',
        link: 'ربط حساب ديسكورد', unlink: 'حذف الحساب المحفوظ', check: 'التحقق من صلاحية الحساب', quests: '🎮 **المهام**',
        one: 'اختيار وتنفيذ مهمة واحدة', all: 'تنفيذ كل المهام مرة واحدة', list: 'عرض كل المهام وحالتها', auto: 'تنفيذ المهام الجديدة تلقائياً',
        tools: '🛠️ **أدوات**', ping: 'فحص سرعة البوت', help: 'أنت هنا الآن', languageCmd: 'تغيير لغتك', settingsCmd: 'إعدادات تنفيذ AutoQuest', owner: '👑 **أوامر المالك**',
        allUsers: 'تنفيذ المهام لكل المستخدمين المرتبطين', grant: 'منح صلاحية مميزة', revoke: 'إزالة الصلاحية المميزة', premiumList: 'عرض المستخدمين المميزين',
        servers: `يخدم **${client.guilds.cache.size}** سيرفر · البادئة:`, language: 'اللغة:',
    };

    c.addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${text.title}\n${text.greeting}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar)));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `${text.account}\n` +
        `\`/link\`  \`${PREFIX}link\` — ${text.link}\n` +
        `\`/unlink\`  \`${PREFIX}unlink\` — ${text.unlink}\n` +
        `\`/tokencheck\`  \`${PREFIX}tokencheck\` — ${text.check}`,
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `${text.quests}\n` +
        `\`/quest\`  \`${PREFIX}quest\` — ${text.one}\n` +
        `\`/questall\`  \`${PREFIX}questall\` — ${text.all}\n` +
        `\`/questlist\`  \`${PREFIX}questlist\` — ${text.list}\n` +
        `\`/autoquest\`  \`${PREFIX}autoquest\` — ${text.auto}`,
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `${text.tools}\n\`/ping\`  \`${PREFIX}ping\` — ${text.ping}\n\`/help\`  \`${PREFIX}help\` — ${text.help}\n\`/language\`  \`${PREFIX}language ar|en\` — ${text.languageCmd}\n\`/settings\`  \`${PREFIX}settings\` — ${text.settingsCmd}`,
    ));

    if (String(user.id) === OWNER_ID) {
        c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `${text.owner}\n` +
            `\`/questforallusers\`  \`${PREFIX}questforallusers\` — ${text.allUsers}\n` +
            `\`/premium grant\`  \`${PREFIX}premium grant @user\` — ${text.grant}\n` +
            `\`/premium revoke\`  \`${PREFIX}premium revoke @user\` — ${text.revoke}\n` +
            `\`/premium list\`  \`${PREFIX}premium list\` — ${text.premiumList}`,
        ));
    }

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${text.servers} \`${PREFIX}\``));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('language_select')
            .setPlaceholder(english ? 'Choose your language' : 'اختر لغتك')
            .addOptions(
                { label: 'العربية', value: 'ar', description: english ? 'Use Arabic messages' : 'استخدام الرسائل العربية', emoji: '🇸🇦' },
                { label: 'English', value: 'en', description: english ? 'Use English messages' : 'استخدام الرسائل الإنجليزية', emoji: '🇬🇧' },
            ),
    ));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('language_ar').setLabel('العربية').setStyle(english ? ButtonStyle.Secondary : ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('language_en').setLabel('English').setStyle(english ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ));
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}
