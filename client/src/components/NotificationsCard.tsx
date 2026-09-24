import React from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useToast } from './Toast';

export default function NotificationsCard({ description }: { description: string }) {
  const { state, loading, enable, disable } = usePushNotifications();
  const { toast } = useToast();

  if (state === 'unsupported') return null;

  async function handleEnable() {
    const res = await enable();
    if (res.ok) toast('Push notifications turned on', 'success');
    else toast(res.error || 'Could not enable notifications', 'error');
  }

  async function handleDisable() {
    await disable();
    toast('Push notifications turned off', 'success');
  }

  return (
    <div className="card px-5 py-5">
      <h2 className="font-semibold text-[#0D3040] text-sm flex items-center gap-2 mb-2">
        <Bell className="w-4 h-4" />
        Push Notifications
      </h2>
      <p className="text-xs text-gray-400 mb-3">{description}</p>

      {state === 'denied' ? (
        <p className="text-sm text-gray-500">
          Notifications are blocked for this site in your browser settings. Allow them there to turn this on.
        </p>
      ) : state === 'subscribed' ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
            On for this device
          </p>
          <button onClick={handleDisable} disabled={loading} className="btn-secondary text-sm shrink-0">
            Turn off
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <BellOff className="w-4 h-4 shrink-0" />
            Off for this device
          </p>
          <button onClick={handleEnable} disabled={loading} className="btn-primary text-sm shrink-0">
            Turn on
          </button>
        </div>
      )}
    </div>
  );
}
