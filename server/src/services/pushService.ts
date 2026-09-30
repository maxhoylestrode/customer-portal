import prisma from '../config/prisma';
import webpush, { pushConfigured } from '../config/push';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

// Sends to every subscription (device/browser) a user has registered.
// Expired/invalid subscriptions (404/410 from the push service) are
// cleaned up automatically. Never throws — a push failure should never
// take down the request that triggered it.
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  if (!pushConfigured) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error('Push send failed:', err);
        }
      }
    })
  );
}

export async function sendPushToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  await Promise.all(userIds.map((id) => sendPushToUser(id, payload)));
}

export async function sendPushToRole(role: string, payload: PushPayload): Promise<void> {
  const users = await prisma.user.findMany({ where: { role }, select: { id: true } });
  await sendPushToUsers(users.map((u) => u.id), payload);
}
