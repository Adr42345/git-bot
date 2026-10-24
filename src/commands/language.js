import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { PREFIX } from '../utils/config.js';

function buttons(selected = 'ar') {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('language_ar').setLabel('العربية').setStyle(selected === 'ar' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('language_en').setLabel('English').setStyle(selected === 'en' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    )];
}

export default {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('اختيار لغة رسائل البوت / Choose bot language')
        .addStringOption((option) => option
            .setName('language')
            .setDescription('اللغة / Language')
            .setRequired(true)
            .addChoices({ name: 'العربية', value: 'ar' }, { name: 'English', value: 'en' })),
    prefix: 'language',
    async execute(interaction, client) {
        const language = interaction.options.getString('language');
        await client.languageStore.set(interaction.guildId, interaction.user.id, language);
        const content = language === 'en' ? '✅ Your language was changed to English.' : '✅ تم تغيير لغتك إلى العربية.';
        await interaction.reply({ content, components: buttons(language), flags: MessageFlags.Ephemeral });
    },
    async prefixExecute(message, args, client) {
        const value = String(args[0] || '').toLowerCase();
        const language = ['en', 'english', 'إنجليزي', 'الانجليزية'].includes(value) ? 'en' : ['ar', 'arabic', 'عربي', 'العربية'].includes(value) ? 'ar' : null;
        if (!language) return message.reply(`الاستخدام: ${PREFIX}language ar أو ${PREFIX}language en`);
        await client.languageStore.set(message.guild.id, message.author.id, language);
        await message.reply(language === 'en' ? '✅ Your language was changed to English.' : '✅ تم تغيير لغتك إلى العربية.');
    },
};
