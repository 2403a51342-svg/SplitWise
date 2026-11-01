import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!getToken());

  // Restore the session after a page reload.
  useEffect(() => {
    if (!getToken()) return;
    api('/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  // Any 401 from the API (expired token) signs the user out.
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('sm:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sm:unauthorized', onUnauthorized);
  }, []);

  const finish = useCallback((data) => {
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (email, password) => finish(await api('/auth/login', { method: 'POST', body: { email, password } })),
    [finish],
  );

  const register = useCallback(
    async (name, email, password) =>
      finish(await api('/auth/register', { method: 'POST', body: { name, email, password } })),
    [finish],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const data = await api('/me', { method: 'PATCH', body: patch });
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateProfile }),
    [user, loading, login, register, logout, updateProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
