// : ! Synora 乂 Development !
// + Discord: its2yashpatel_
// + Community: https://dsc.gg/synoraxdev (Synora 乂 Development)
// + for any queries reach out Community or DM me.

import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
} from 'discord.js';
import { getEmoji } from '../handlers/emoji.js';

function statusLabel(ws) {
  if (ws < 80)  return { text: 'سريع جداً', color: 0x57F287 };
  if (ws < 150) return { text: 'الاتصال ممتاز', color: 0x57F287 };
  if (ws < 250) return { text: 'فيه بطء بسيط', color: 0xFEE75C };
  return { text: 'التأخير مرتفع شوي', color: 0xED4245 };
}

function buildPingCard(ws, rest, avatar) {
  const { text, color } = statusLabel(ws);
  const c = new ContainerBuilder().setAccentColor(color);

  c.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${getEmoji('ping')} فحص الاستجابة\n-# ${text}`,
        ),
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
  );

  c.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
  );

  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${getEmoji('info')} **استجابة WebSocket** — \`${ws}ms\`\n${getEmoji('arrow')} **استجابة REST** — \`${rest}ms\``,
    ),
  );

  c.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
  );

  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# ${ws < 150 ? getEmoji('success') + ' كل الأنظمة تعمل بشكل ممتاز' : ws < 250 ? getEmoji('warning') + ' فيه تأخير بسيط' : getEmoji('error') + ' التأخير مرتفع، راقب الاتصال'}`,
    ),
  );

  return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('فحص سرعة استجابة البوت'),
  prefix: 'ping',

  async execute(interaction) {
    const ws = interaction.client.ws.ping;
    const t = Date.now();
    await interaction.deferReply();
    const rest = Date.now() - t;
    const avatar = interaction.client.user.displayAvatarURL({ size: 128, extension: 'png' });
    await interaction.editReply(buildPingCard(ws, rest, avatar));
  },

  async prefixExecute(message, _a, client) {
    const ws = client.ws.ping;
    const t = Date.now();
    const sent = await message.reply('...');
    const rest = Date.now() - t;
    const avatar = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    await sent.edit({ content: '', ...buildPingCard(ws, rest, avatar) });
  },
};

// : ! Synora 乂 Development !
// + Discord: its2yashpatel_
// + Community: https://dsc.gg/synoraxdev (Synora 乂 Development)
// + for any queries reach out Community or DM me.
