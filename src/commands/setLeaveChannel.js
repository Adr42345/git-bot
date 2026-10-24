/**
 * setLeaveChannel.js - Set Leave Channel per Server
 * Location: src/commands/setLeaveChannel.js
 */

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getCollection } from '../utils/mongo.js';

export const setLeaveChannelCmd = {
    data: new SlashCommandBuilder()
        .setName('setleavechannel')
        .setDescription('تحديد قناة مغادرة الأعضاء')
        .addChannelOption(o => 
            o.setName('channel')
             .setDescription('اختر قناة المغادرة')
             .addChannelTypes(ChannelType.GuildText)
             .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    prefix: ['setleave', 'setleavechannel'],

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        // Fixed collection name to match guildSettings
        const col = await getCollection('guildSettings');

        if (!col) return interaction.reply({ content: '❌ صار خطأ في التخزين المحلي!', ephemeral: true });

        await col.updateOne(
            { guildId: interaction.guild.id },
            { $set: { leaveChannelId: channel.id, updatedAt: new Date() } },
            { upsert: true }
        );

        await interaction.reply({ content: `✅ تم تحديد قناة المغادرة إلى <#${channel.id}>!`, ephemeral: true });
    },

    async prefixExecute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ تحتاج صلاحية إدارة السيرفر لاستخدام هذا الأمر.');
        }

        const channel = message.mentions.channels.first();
        if (!channel) {
            return message.reply('الاستخدام: `!setleave #القناة`');
        }

        // Fixed collection name to match guildSettings
        const col = await getCollection('guildSettings');
        if (!col) return message.reply('❌ صار خطأ في التخزين المحلي!');

        await col.updateOne(
            { guildId: message.guild.id },
            { $set: { leaveChannelId: channel.id, updatedAt: new Date() } },
            { upsert: true }
        );

        await message.reply(`✅ تم تحديد قناة المغادرة إلى <#${channel.id}>!`);
    }
};
