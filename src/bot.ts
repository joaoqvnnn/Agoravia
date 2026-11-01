import { Telegraf } from 'telegraf';
import { env } from './config/env';
import { registrationMiddleware } from './middlewares/registration';
import { channelGuard } from './middlewares/channelGuard';
import { startHandler } from './handlers/start';
import { cancelHandler } from './handlers/cancel';
import { registerChannelJoin } from './handlers/channelJoin';
import { registerCallbackRouter } from './handlers/router';

export const bot = new Telegraf(env.BOT_TOKEN);

// Registro universal do usuário
bot.use(registrationMiddleware);

// Bloqueio de não-membros
bot.use(channelGuard);

// Comandos
bot.start(startHandler);
bot.command('cancelar', cancelHandler);

// Entrada/saída do canal obrigatório
registerChannelJoin(bot);

// Roteador de botões inline
registerCallbackRouter(bot);

// Fallback de erros
bot.catch((err, ctx) => {
  console.error('[BOT ERROR]', (err as Error).message, ctx.updateType);
});
