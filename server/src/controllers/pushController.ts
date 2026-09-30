import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { VAPID_PUBLIC_KEY, pushConfigured } from '../config/push';

export function getPublicKey(_req: Request, res: Response) {
  res.json({ key: VAPID_PUBLIC_KEY, enabled: pushConfigured });
}

export async function subscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'A valid push subscription (endpoint + keys) is required' });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.user!.userId, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: req.user!.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function unsubscribe(req: Request, res: Response, next: NextFunction) {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user!.userId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Lets the profile page show whether *this* browser is currently subscribed
export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { endpoint } = req.query;
    if (!endpoint) return res.json({ subscribed: false });

    const sub = await prisma.pushSubscription.findFirst({
      where: { endpoint: endpoint as string, userId: req.user!.userId },
    });
    res.json({ subscribed: !!sub });
  } catch (err) {
    next(err);
  }
}
