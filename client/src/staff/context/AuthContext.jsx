// Adapter over the app's single shared auth state (store/authStore.ts),
// exposing the { user, loading } shape the ported staff-portal pages expect.
// Login/logout for the whole app go through the existing auth pages/Layout —
// staff pages here only ever read `user`.
import { useAuthContext } from '../../store/authStore';

export function useAuth() {
  const { user, isLoading } = useAuthContext();
  return { user, loading: isLoading };
}
