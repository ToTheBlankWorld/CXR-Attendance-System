import { useState, useEffect, useCallback, useRef } from 'react';

export const useWebSocket = (lectureId) => {
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    if (!lectureId) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/${lectureId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type !== 'pong') {
        setNotifications((prev) => [data, ...prev].slice(0, 50));
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return ws;
  }, [lectureId]);

  useEffect(() => {
    const ws = connect();
    return () => {
      if (ws) ws.close();
    };
  }, [connect]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, isConnected, sendMessage, clearNotifications };
};
