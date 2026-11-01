import { bot } from './bot';
import { env } from './config/env';
import { db } from './db';

async function bootstrap() {
  await db.query('SELECT 1'); // valida conexão
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Iniciar o bot' },
    { command: 'cancelar', description: 'Cancelar a operação atual' },
  ]);

  await bot.launch();
  console.log(`[BOT] online — @${env.BOT_USERNAME}`);

  // Graceful shutdown (Render envia SIGTERM)
  const shutdown = async () => {
    console.log('[BOT] desligando...');
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
