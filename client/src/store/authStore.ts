import { createContext, useContext } from 'react';
import { User } from '../types';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  setUser: () => {},
});

export const useAuthContext = () => useContext(AuthContext);
