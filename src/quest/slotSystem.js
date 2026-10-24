/**
 * slotSystem.js - Progressive Slot Display (Step-by-Step Unlock)
 * Location: src/quest/slotSystem.js
 */

import { getRoles } from './roleStore.js';
import { getUserInvites } from '../handlers/inviteTracker.js';

export const SLOTS = {
    1: { label: 'Free Slot', need: 'Free', invites: 0, boosts: 0 },
    2: { label: '2 Invite Slot', need: '2 Invites', invites: 2, boosts: 0 },
    3: { label: '5 Invite Slot', need: '5 Invites', invites: 5, boosts: 0 },
    4: { label: '10 Invite OR 1 Boost Slot', need: '10 Invites OR 1 Boost', invites: 10, boosts: 1 },
    5: { label: '2 Boost Slot', need: '2 Boosts', invites: 0, boosts: 2 },
};

export async function getCounts(member) {
    try {
        if (!member || !member.guild) return { invites: 0, boosts: 0 };

        const guildId = member.guild.id;
        const userId = member.id;

        // Fetch real-time invites from local JSON via inviteTracker
        let invites = await getUserInvites(userId, guildId);

        let boosts = 0;
        const roles = getRoles(guildId);
        
        if (member.premiumSince) boosts = 1;
        if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) boosts = Math.max(boosts, 1);
        if (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) boosts = 2;

        // Fallback role checks if DB invites are lower
        if (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) invites = Math.max(invites, 10);
        else if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) invites = Math.max(invites, 10);
        else if (roles.ROLE_5_INVITES && member.roles.cache.has(roles.ROLE_5_INVITES)) invites = Math.max(invites, 5);
        else if (roles.ROLE_2_INVITES && member.roles.cache.has(roles.ROLE_2_INVITES)) invites = Math.max(invites, 2);

        return { invites, boosts };
    } catch (err) {
        console.error("getCounts error:", err.message);
        return { invites: 0, boosts: 0 };
    }
}

export async function getProgressiveSlots(member) {
    const guildId = member?.guild?.id || 'global';
    const { invites, boosts } = await getCounts(member);
    const roles = getRoles(guildId);
    const slots = Object.entries(SLOTS).map(([slot, data]) => ({
        slot: Number(slot), ...data, can: true, reason: 'Available', needRoleId: '',
        currentInvites: invites, currentBoosts: boosts,
    }));
    return { slots, invites, boosts, slotsToShow: slots.length, hasRole2: true, hasRole5: true, hasBoost1: true, hasBoost2: true, roles };
}

export async function getMaxVisibleSlots(guild, userId) {
    try {
        if (!guild) return 1;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return 1;
        
        const { invites, boosts } = await getCounts(member);
        let max = 1;
        if (invites >= 2) max = 2;
        if (invites >= 5) max = 3;
        if (invites >= 10 || boosts >= 1) max = 4;
        if (boosts >= 2) max = 5;
        return max;
    } catch { return 1; }
}
