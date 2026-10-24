import {
    ActionRowBuilder,
    MessageFlags,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';
import { PREFIX } from '../utils/config.js';

function modeMenu(selected = 'sequential') {
    return [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('settings_autoquest_mode')
            .setPlaceholder('اختر طريقة تنفيذ المهام')
            .addOptions(
                {
                    label: 'مهمة وراء مهمة — آمن',
                    value: 'sequential',
                    description: 'تنفيذ مهمة واحدة ثم الانتقال للتالية',
                    emoji: '🛡️',
                    default: selected === 'sequential',
                },
                {
                    label: 'كل المهام معاً — أسرع',
                    value: 'parallel',
                    description: 'تشغيل المهام في نفس الوقت',
                    emoji: '⚡',
                    default: selected === 'parallel',
                },
            ),
    )];
}

export default {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('إعدادات المستخدم وطريقة تنفيذ AutoQuest'),
    prefix: 'settings',
    async execute(interaction, client) {
        const mode = await client.settingsStore.getAutoquestMode(interaction.guildId, interaction.user.id);
        await interaction.reply({
            content: `⚙️ **إعداداتك**\nطريقة تنفيذ AutoQuest الحالية: **${mode === 'parallel' ? 'كل المهام معاً' : 'مهمة وراء مهمة — آمن'}**`,
            components: modeMenu(mode),
            flags: MessageFlags.Ephemeral,
        });
    },
    async prefixExecute(message, _args, client) {
        const mode = await client.settingsStore.getAutoquestMode(message.guild.id, message.author.id);
        await message.reply({
            content: `⚙️ **إعداداتك**\nطريقة تنفيذ AutoQuest الحالية: **${mode === 'parallel' ? 'كل المهام معاً' : 'مهمة وراء مهمة — آمن'}**\n\nغيّرها من القائمة بالأسفل.`,
            components: modeMenu(mode),
        });
    },
};
