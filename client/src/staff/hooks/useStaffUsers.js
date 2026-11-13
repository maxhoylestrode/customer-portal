import { useEffect, useState } from 'react';
import api from '../api';

// Staff who can be assigned to tasks (admin + staff; sales can't see tasks).
// Fetched once and shared by every picker on the page.
let cache = null;
let inflight = null;

function load() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .get('/users')
      .then((r) => {
        cache = (Array.isArray(r.data) ? r.data : []).filter((u) => u.role !== 'sales');
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export default function useStaffUsers() {
  const [users, setUsers] = useState(cache || []);
  useEffect(() => {
    let alive = true;
    load()
      .then((list) => alive && setUsers(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return users;
}
