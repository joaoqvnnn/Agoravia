import express from 'express';
import { env } from './config/env';
import { pixWebhookHandler } from './handlers/pixWebhook';

export function startWebhookServer(): void {
  const app = express();
  app.use(express.json());
  app.get('/', (_req, res) => res.send('ok'));
  app.post('/webhook/mercadopago', pixWebhookHandler);
  app.listen(env.PORT, () => console.log(`[WEBHOOK] :${env.PORT}`));
}
