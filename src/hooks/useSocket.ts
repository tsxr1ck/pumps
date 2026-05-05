import { useEffect, useRef, useCallback } from 'react';
import { getSocket, reconnectSocket } from '@/lib/socket';

export function useSocket() {
  const socketRef = useRef(getSocket());

  useEffect(() => {
    reconnectSocket();
    socketRef.current = getSocket();
  }, []);

  const subscribe = useCallback((event: string, handler: (data: unknown) => void) => {
    const socket = socketRef.current;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, []);

  return { subscribe, socket: socketRef.current };
}
