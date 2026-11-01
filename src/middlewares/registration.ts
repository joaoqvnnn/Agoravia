import { MiddlewareFn } from 'telegraf';
import { ensureUser } from '../services/users';

export const registrationMiddleware: MiddlewareFn = async (ctx, next) => {
  const from = ctx.from;
  if (from && !from.is_bot) {
    await ensureUser({
      id: from.id,
      username: from.username,
      first_name: from.first_name,
      last_name: from.last_name,
    });
  }
  return next();
};
