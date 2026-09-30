import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'not-subscribed';

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('not-subscribed');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'subscribed' : 'not-subscribed');
    } catch {
      setState('not-subscribed');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function enable(): Promise<{ ok: boolean; error?: string }> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, error: 'Push notifications are not supported in this browser' };
    }
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return { ok: false, error: 'Permission was not granted' };
      }
      const reg = await navigator.serviceWorker.ready;
      const { data } = await api.get<{ key: string; enabled: boolean }>('/push/vapid-public-key');
      if (!data.enabled || !data.key) {
        return { ok: false, error: 'Push notifications are not configured on the server' };
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.key) as BufferSource,
        });
      }
      await api.post('/push/subscribe', sub.toJSON());
      setState('subscribed');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to enable notifications' };
    } finally {
      setLoading(false);
    }
  }

  async function disable(): Promise<void> {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState('not-subscribed');
    } finally {
      setLoading(false);
    }
  }

  return { state, loading, enable, disable };
}
