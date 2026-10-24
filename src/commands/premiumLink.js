/**
 * premiumLink.js - Fixed Formatting & Clean UI Panel - FINAL
 * Location: src/commands/premiumLink.js
 */

import {
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, 
    ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    MessageFlags, SlashCommandBuilder,
} from 'discord.js';
import { getProgressiveSlots } from '../quest/slotSystem.js';


function getClientPrefix(client, guildId) {
    try {
        if (client?.getPrefix) return client.getPrefix(guildId);
        if (client?.config?.prefix) return client.config.prefix;
        if (client?.prefix) return client.prefix;
    } catch {}
    return process.env.BOT_PREFIX || ';';
}


function getMaxSlots(client) {
    return Math.max(1, Math.min(5, Number(client?.config?.maxSlots) || 5));
}

function noSlotsResponse(maxSlots) {
    const c = new ContainerBuilder().setAccentColor(0xFEE75C);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `# لا توجد خانات متاحة\nلقد استخدمت جميع الخانات المتاحة (${maxSlots}/${maxSlots}).\nاحذف حساباً مرتبطاً باستخدام \`/unlink\` أولاً، ثم حاول مرة أخرى.`
    ));
    return { components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

async function getAvailableSlot(client, guildId, userId, member = null) {
    const maxSlots = getMaxSlots(client);
    const accounts = await client.tokenStore.getAllSlots(guildId, userId);
    if (accounts.some((account) => String(account.linkedUserId) === String(userId))) {
        return { slot: null, maxSlots, alreadyLinked: true };
    }
    const premium = await client.premiumStore?.isPremium(guildId, userId);
    const progressive = member ? await getProgressiveSlots(member) : { slots: [] };
    for (let slot = 1; slot <= maxSlots; slot++) {
        if (accounts.some((account) => account.slot === slot)) continue;
        const slotData = progressive.slots.find((item) => item.slot === slot);
        if (premium || !member || slotData?.can) return { slot, maxSlots };
    }
    return { slot: null, maxSlots };
}

function getAccountAge(discordId) {
    try {
        if (!discordId) return 'N/A';
        const ts = Number((BigInt(discordId) >> 22n) + 1420070400000n);
        const days = Math.floor((Date.now() - ts) / 86400000);
        if (days < 30) return `${days} days ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months} months ago`;
        return `${Math.floor(months/12)} years ago`;
    } catch { return 'N/A'; }
}

export async function buildPremiumLinkPanel(guildId, ownerId, tokenStore, client, member = null) {
    const prefix = getClientPrefix(client, guildId);
    const guildMember = member || await client.guilds.cache.get(guildId)?.members.fetch(ownerId).catch(() => null);
    const { slots } = await getProgressiveSlots(guildMember);
    const slotsToShow = slots.length;
    const invites = 0;
    const boosts = 0;

    let accounts = await tokenStore.getAllSlots(guildId, ownerId);

    if (accounts.length > 0) {
        const activeAccounts = accounts.filter(a => a.isActive);
        if (activeAccounts.length !== 1) {
            const targetActiveSlot = activeAccounts.length > 0 ? activeAccounts[0].slot : accounts[0].slot;
            await tokenStore.setActiveSlot(guildId, ownerId, targetActiveSlot);
            accounts = await tokenStore.getAllSlots(guildId, ownerId);
        }
    }

    const c1 = new ContainerBuilder().setAccentColor(0x5865F2);
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent('# ربط الحساب'));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**التخزين المحلي للحساب**\nYour token is encrypted and stored in this project\'s local data folder. No premium tier or external database is used.\n` +
        `استخدم \`${prefix}guide\` للمساعدة. الحساب النشط ينفذ المهام — استخدم \`${prefix}quest\` للمهمة الحالية أو \`${prefix}questall\` للجميع.\n\n` +
        `> **Invites:** ${invites} \vert{} **Boosts:**${boosts}`
    ));

    const c2 = new ContainerBuilder().setAccentColor(0x2B2D31);
    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## لوحة الحساب (${slotsToShow} خانات ظاهرة)`));

    for (let idx = 0; idx < slots.length; idx++) {
        const slotData = slots[idx];
        const slotNum = slotData.slot;
        const linked = accounts.find(a => a.slot === slotNum);

        if (!linked) {
            if (slotData.can) {
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### #${slotNum} إعدادات الحساب\n` +
                    `• **المستخدم:** غير مرتبط (${slotData.label})\n` +
                    `• **الحالة:** غير نشط\n` +
                    `• **المتطلب:** ${slotData.need} - ✅ متاح\n` +
                    `• **عمر الحساب:** N/A\n` +
                    `• **تاريخ الربط:** N/A`
                ));
                c2.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`link_slot_${slotNum}`).setLabel('ربط').setStyle(ButtonStyle.Success)
                ));
            } else {
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### #${slotNum} إعدادات الحساب 🔒\n` +
                    `• **المستخدم:** مقفلة (${slotData.label})\n` +
                    `• **الحالة:** مقفلة\n` +
                    `• **المتطلب:** ${slotData.need}\n` +
                    `• **Note:** ${slotData.reason}`
                ));
                c2.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`locked_slot_${slotNum}`).setLabel(`مقفلة (${slotData.need})`).setStyle(ButtonStyle.Secondary).setDisabled(true)
                ));
            }
        } else {
            const isCurrentlyActive = Boolean(linked.isActive);
            const status = isCurrentlyActive ? 'نشط ✅' : 'غير نشط';
            const age = getAccountAge(linked.linkedUserId);
            const linkedAt = linked.linkedAt ? new Date(linked.linkedAt).toLocaleDateString('ar-SA', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
            
            const content = 
                `### #${slotNum} إعدادات الحساب\n` +
                `• **المستخدم:** ${linked.username} (\`${linked.linkedUserId || 'N/A'}\`)\n` +
                `• **نوع الخانة:** ${slotData.label}\n` +
                `• **الحالة:** ${status}\n` +
                `• **عمر الحساب:** ${age}\n` +
                `• **تاريخ الربط:** ${linkedAt}`;
            
            c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
            
            const row = new ActionRowBuilder();
            row.addComponents(new ButtonBuilder().setCustomId(`unlink_slot_${slotNum}`).setLabel('إلغاء الربط').setStyle(ButtonStyle.Danger));
            if (!isCurrentlyActive) {
                row.addComponents(new ButtonBuilder().setCustomId(`select_slot_${slotNum}`).setLabel('تحديد').setStyle(ButtonStyle.Primary));
            }
            c2.addActionRowComponents(row);
        }

        if (idx < slots.length - 1) {
            c2.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        }
    }

    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# الحساب المحدد يستخدم لأوامر المهام.'));
    return { components: [c1, c2], flags: MessageFlags.IsComponentsV2 };
}

export function buildLinkModal(slot, guildId = '') {
    const m = new ModalBuilder().setCustomId(`link_modal_${guildId || 'none'}_${slot}`).setTitle(`ربط الحساب - الخانة ${slot}`);
    m.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('token_input').setLabel('رمز حساب ديسكورد').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('ألصق رمز الحساب هنا...')
    ));
    return m;
}

const linkData = new SlashCommandBuilder().setName('link').setDescription('ربط حساب محلي لاستخدام أوامر المهام');

export const linkCmd = {
    data: linkData,
    prefix: 'link',
    async execute(interaction, client) {
        try {
            const available = await getAvailableSlot(client, interaction.guild.id, interaction.user.id, interaction.member);
            if (available.alreadyLinked) {
                return await interaction.reply({ content: 'حسابك مرتبط مسبقاً بخانة واحدة. استخدم `/unlink` إذا تبي تغيّر الحساب.', flags: MessageFlags.Ephemeral });
            }
            if (!available.slot) return await interaction.reply(noSlotsResponse(available.maxSlots));
            await interaction.showModal(buildLinkModal(available.slot, interaction.guild.id));
        } catch (error) {
            await interaction.reply({ content: `تعذر فتح نموذج الربط: ${String(error.message || error).slice(0, 300)}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
    async prefixExecute(message, _args, client) {
        const available = await getAvailableSlot(client, message.guild.id, message.author.id, message.member);
        const text = available.slot
            ? `لربط حسابك بشكل آمن، استخدم الأمر \`/link\` لفتح نموذج الربط الخاص بك.\nالخانة التالية المتاحة: ${available.slot}/${available.maxSlots}`
            : available.alreadyLinked
            ? 'حسابك مرتبط مسبقاً بخانة واحدة. استخدم !unlink إذا تبي تغيّر الحساب.'
            : `لا توجد خانات متاحة. جميع الخانات مستخدمة (${available.maxSlots}/${available.maxSlots}). احذف خانة باستخدام \`${getClientPrefix(client, message.guild.id)}unlink 1\` ثم حاول مرة أخرى.`;
        try {
            const dm = await message.author.createDM();
            if (available.slot) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`link_dm_${message.guild.id}_${available.slot}`).setLabel('فتح نموذج الربط').setStyle(ButtonStyle.Primary),
                );
                await dm.send({ content: `🔗 ${text}`, components: [row] });
            } else {
                await dm.send(`🔗 ${text}`);
            }
        }
        catch { await message.reply('تعذر إرسال رسالة خاصة لك. استخدم الأمر `/link` من فضلك.').catch(() => {}); }
    }
};

export const unlinkCmd = {
    data: new SlashCommandBuilder().setName('unlink').setDescription('إلغاء ربط خانة').addIntegerOption(o=>o.setName('slot').setDescription('رقم الخانة من 1 إلى 5').setRequired(true).setMinValue(1).setMaxValue(5)),
    prefix: 'unlink',
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        const slot = interaction.options.getInteger('slot');
        await client.tokenStore.removeSlot(interaction.guild.id, interaction.user.id, slot);
        const panel = await buildPremiumLinkPanel(interaction.guild.id, interaction.user.id, client.tokenStore, client, interaction.member);
        await interaction.editReply(panel);
    },
    async prefixExecute(message, args, client) {
        const prefix = getClientPrefix(client, message.guild.id);
        const slot = parseInt(args[0]); 
        if (!slot || slot < 1 || slot > 5) return message.reply(`Usage: \`${prefix}unlink 1\``);
        await client.tokenStore.removeSlot(message.guild.id, message.author.id, slot);
        const panel = await buildPremiumLinkPanel(message.guild.id, message.author.id, client.tokenStore, client, message.member);
        await message.reply(panel);
    }
};

export async function handleButton(interaction, client) {
    const dmLink = interaction.customId.startsWith('link_dm_');
    const guildId = interaction.guildId || (dmLink ? interaction.customId.split('_')[2] : null);
    const ownerId = interaction.user.id;
    const member = interaction.member || await client.guilds.cache.get(guildId)?.members.fetch(ownerId).catch(() => null);

    if (interaction.customId.startsWith('link_slot_') || dmLink) {
        const slotNum = dmLink ? parseInt(interaction.customId.split('_')[3]) : parseInt(interaction.customId.split('_')[2]);
        const prog = await getProgressiveSlots(member);
        const slotData = prog.slots.find(s => s.slot === slotNum);
        const premium = await client.premiumStore?.isPremium(guildId, ownerId);
        if (!slotData?.can && !premium) {
            return await interaction.reply({ 
                content: `🔒 **Slot #${slotNum} مقفلة!**\n**المتطلب:** ${slotData?.need}\n${slotData?.reason}`, 
                flags: MessageFlags.Ephemeral 
            });
        }
        return await interaction.showModal(buildLinkModal(slotNum, guildId));
    }

    if (interaction.customId.startsWith('unlink_slot_')) {
        const slotToUnlink = parseInt(interaction.customId.split('_')[2]);
        await client.tokenStore.removeSlot(guildId, ownerId, slotToUnlink);
        const panel = await buildPremiumLinkPanel(guildId, ownerId, client.tokenStore, client, member);
        return await interaction.update(panel);
    }

    if (interaction.customId.startsWith('select_slot_')) {
        const slotToSelect = parseInt(interaction.customId.split('_')[2]);
        await client.tokenStore.setActiveSlot(guildId, ownerId, slotToSelect);
        const panel = await buildPremiumLinkPanel(guildId, ownerId, client.tokenStore, client, member);
        return await interaction.update(panel);
    }
}

export async function handleModal(interaction, client) {
    if (!interaction.customId.startsWith('link_modal_')) return;
    const parts = interaction.customId.split('_');
    const slot = parseInt(parts.at(-1));
    const guildId = interaction.guildId || parts[2];
    const guild = client.guilds.cache.get(guildId);
    const member = interaction.member || await guild?.members.fetch(interaction.user.id).catch(() => null);
    const token = interaction.fields.getTextInputValue('token_input').trim();
    const prefix = getClientPrefix(client, guildId);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const prog = await getProgressiveSlots(member);
        const slotData = prog.slots.find(s => s.slot === slot);
        const premium = await client.premiumStore?.isPremium(guildId, interaction.user.id);
        if (!slotData?.can && !premium) throw new Error(`الخانة رقم ${slot} مقفلة! ${slotData?.reason || ''}`);
        const existing = await client.tokenStore.getAllSlots(guildId, interaction.user.id);
        if (existing.some((account) => String(account.linkedUserId) === String(interaction.user.id))) {
            throw new Error('حسابك مرتبط مسبقاً بخانة واحدة. احذف الربط الحالي أولاً.');
        }
        const data = { id: interaction.user.id, username: interaction.user.username, avatar: interaction.user.avatar };
        const saved = await client.tokenStore.saveSlot({
            guildId, ownerId: interaction.user.id, slot, token,
            linkedUserId: data.id, username: data.username, avatar: data.avatar, linkedAt: new Date()
        });
        if (!saved) throw new Error('تعذر حفظ الحساب في التخزين المحلي.');
        await client.tokenStore.setActiveSlot(guildId, interaction.user.id, slot);
        if (interaction.message) {
            const updatedPanel = await buildPremiumLinkPanel(guildId, interaction.user.id, client.tokenStore, client, member);
            await interaction.message.edit(updatedPanel).catch(() => {});
        }
        const successContainer = new ContainerBuilder().setAccentColor(0x57F287);
        successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ✅ تم ربط الحساب\nتم الربط باسم **"${data.username}"** في الخانة ${slot}.\n\nتقدر الآن تستخدم أوامر المهام: \`${prefix}quest\` و\`${prefix}questall\` و\`${prefix}questlist\`.\nلإلغاء الربط استخدم \`${prefix}unlink ${slot}\`.`
        ));
        await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    } catch (e) {
        const errContainer = new ContainerBuilder().setAccentColor(0xED4245);
        errContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ تعذر ربط الحساب في الخانة ${slot}\n${e.message}`));
        await interaction.editReply({ components: [errContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
}
