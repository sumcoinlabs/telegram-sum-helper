import { TelegramClient } from './telegram.js';
import { State } from './state.js';
import { Knowledge } from './knowledge.js';
import { Learning } from './learning.js';
import { ConversationAI } from './ai.js';
import { createHandler } from './bot.js';
import { Escalations } from './escalations.js';
import { GroupIndex } from './group-index.js';
import { VERSION } from './version.js';

const token=process.env.TELEGRAM_BOT_TOKEN?.trim();
const config={allowedChatUsername:(process.env.ALLOWED_CHAT_USERNAME||'').trim().replace(/^@/,''),allowedChatId:process.env.ALLOWED_CHAT_ID||'',initialMode:process.env.INITIAL_MODE||'observe',userCooldownHours:Number(process.env.USER_COOLDOWN_HOURS||6),topicCooldownSeconds:Number(process.env.TOPIC_COOLDOWN_SECONDS||120),autoAI:process.env.AUTO_AI==='true',groupIndexEnabled:process.env.GROUP_INDEX_ENABLED!=='false',learningEnabled:process.env.LEARNING_ENABLED!=='false',trustedDeveloperIds:(process.env.TRUSTED_DEVELOPER_IDS||'').split(',').map(v=>v.trim()).filter(v=>/^\d{2,20}$/.test(v)).map(Number),allowPrivateChats:process.env.ALLOW_PRIVATE_CHATS==='true',aiDailyLimit:Number(process.env.AI_DAILY_LIMIT||100)};
if(!token||!/^[0-9]+:[\w-]{30,}$/.test(token))throw new Error('Missing/invalid TELEGRAM_BOT_TOKEN.');
if(!config.allowedChatUsername&&!config.allowedChatId)throw new Error('Set an allowed group ID or username.');
if(!['observe','reply'].includes(config.initialMode)||![config.userCooldownHours,config.topicCooldownSeconds,config.aiDailyLimit].every(v=>Number.isFinite(v)&&v>=0))throw new Error('Invalid moderation settings.');
const state=new State(process.env.STATE_FILE||'./data/state.json',config.initialMode);
const learning=new Learning();
const knowledge=new Knowledge({learned:learning.data.approved});
const ai=new ConversationAI({apiKey:process.env.OPENAI_API_KEY||'',model:process.env.OPENAI_MODEL||'gpt-4.1-mini'});
const client=new TelegramClient(token);
const me=await client.getMe();
if(!me.can_read_all_group_messages)console.warn('Bot privacy may prevent free-form group messages unless the bot is a group administrator. See README auto-support setup.');
console.log(`Sumcoin Helper v${VERSION}: @${me.username} | authorized group ${config.allowedChatUsername||config.allowedChatId} | mode ${state.data.mode} | ${knowledge.documents().length} knowledge entries | AI ${ai.apiKey?'configured':'retrieval-only'}`);
await client.deleteWebhook();
try{await client.setMyCommands();}catch(e){console.error('Optional command menu failed:',e.message);}
for(const language of ['es','pt','fr','de','it','ru','zh','ar','hi','ja','ko','tr','id']){try{await client.setMyCommands(language);}catch(e){console.error(`Optional ${language} command menu failed:`,e.message);}}
const escalations=new Escalations(process.env.ESCALATION_FILE||'./data/escalations.json');
const groupIndex=new GroupIndex(process.env.GROUP_INDEX_FILE||'./data/group-index.json');
const handle=createHandler({client,state,config,botUsername:me.username||'',knowledge,learning,ai,escalations,groupIndex});
await handle.tick();
let running=true;for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{running=false;});
let offset=null,failures=0;
while(running){try{
  const updates=await client.getUpdates(offset);failures=0;
  for(const u of updates){offset=u.update_id+1;try{await handle(u.message);}catch(e){console.error(`Message ${u.update_id} failed:`,e.message);}}
  await handle.tick();
}catch(e){const delay=Math.min(60000, e.retryAfter?e.retryAfter*1000:1000*2**Math.min(6,++failures));console.error('Polling failure:',e.message);if(running)await new Promise(r=>setTimeout(r,delay));}}
