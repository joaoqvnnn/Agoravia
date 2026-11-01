import { bot } from './bot';
import { env } from './config/env';
import { db } from './db';
import { startWebhookServer } from './server';
import { startExpiryCron } from './handlers/expiryCron';

async function bootstrap() {
  await db.query('SELECT 1');
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Iniciar o bot' },
    { command: 'cancelar', description: 'Cancelar a operação atual' },
  ]);

  await bot.launch();
  console.log(`[BOT] online — @${env.BOT_USERNAME}`);

  startWebhookServer();
  const cron = startExpiryCron(bot);

  const shutdown = async () => {
    console.log('[BOT] desligando...');
    clearInterval(cron);
    bot.stop('SIGTERM');
    await db.end();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

bootstrap().catch((e) => {
  console.error('[BOOTSTRAP FAIL]', e);
  process.exit(1);
});
