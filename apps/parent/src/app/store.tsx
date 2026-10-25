import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MockBackend, type Backend } from "./backend";
import type { User } from "./types";

interface AppState {
  backend: Backend;
  user: User | null;
  register(email: string, password: string): Promise<User>;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const backend = useMemo(() => new MockBackend(), []);
  const [user, setUser] = useState<User | null>(() => backend.currentUser());

  const register = useCallback(
    async (email: string, password: string) => {
      const u = await backend.register(email, password);
      setUser(u);
      return u;
    },
    [backend],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const u = await backend.login(email, password);
      setUser(u);
      return u;
    },
    [backend],
  );

  const logout = useCallback(async () => {
    await backend.logout();
    setUser(null);
  }, [backend]);

  const value = useMemo(
    () => ({ backend, user, register, login, logout }),
    [backend, user, register, login, logout],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
