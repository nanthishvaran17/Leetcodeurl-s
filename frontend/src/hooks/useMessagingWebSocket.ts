import { useState, useEffect, useCallback } from 'react';
import { useGlobalWebSocket } from '../context/GlobalWebSocketProvider';

export const useMessagingWebSocket = (token: string | null) => {
  const { isConnected, registerCallback, unregisterCallback, sendMessage } = useGlobalWebSocket();
  const [latestMessage, setLatestMessage] = useState<any>(null);

  useEffect(() => {
    const callbackId = 'messaging_hook';
    registerCallback(callbackId, (data) => {
      if (data.type === 'NEW_MESSAGE') {
        setLatestMessage(data.message);
      }
    });

    return () => {
      unregisterCallback(callbackId);
    };
  }, [registerCallback, unregisterCallback]);

  const viewConversation = useCallback((conversationId: string) => {
    sendMessage({ action: 'VIEW_CONVERSATION', conversation_id: conversationId });
  }, [sendMessage]);

  const leaveConversation = useCallback(() => {
    sendMessage({ action: 'LEAVE_CONVERSATION' });
  }, [sendMessage]);

  return { isConnected, latestMessage, viewConversation, leaveConversation };
};
