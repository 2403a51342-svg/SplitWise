import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { apiBase, getToken } from '../api';
import { useAuth } from './auth';
import { useToast } from './toast';

const LiveContext = createContext({ connected: false, version: 0, lastEvent: null });

/**
 * One WebSocket per signed-in user. When anyone in one of your groups adds an expense,
 * records a payment, etc., the server emits `group:changed`. We bump `version` (pages
 * re-fetch when it changes) and show a toast if somebody else made the change.
 */
export function LiveProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [connected, setConnected] = useState(false);
  const [version, setVersion] = useState(0);
  const [lastEvent, setLastEvent] = useState(null);
  const wasConnected = useRef(false);

  useEffect(() => {
    const token = getToken();
    if (!user || !token) return undefined;

    const socket = io(apiBase || undefined, { auth: { token }, transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      setConnected(true);
      // After a dropped connection we may have missed events, so refresh once on reconnect.
      if (wasConnected.current) setVersion((v) => v + 1);
      wasConnected.current = true;
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('group:changed', (event) => {
      setLastEvent(event);
      setVersion((v) => v + 1);
      if (event.actorId !== user.id && event.text) toast(event.text, 'live');
    });

    return () => {
      socket.close();
      wasConnected.current = false;
      setConnected(false);
    };
  }, [user, toast]);

  const value = useMemo(() => ({ connected, version, lastEvent }), [connected, version, lastEvent]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
