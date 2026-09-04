import { useState, useEffect, useCallback } from 'react';
import { useGlobalWebSocket } from '../context/GlobalWebSocketProvider';

export const useMessagingWebSocket = (token: string | null) => {
  const { isConnected, registerCallback, unregisterCallback, sendMessage } = useGlobalWebSocket();
  const [latestMessage, setLatestMessage] = useState<any>(null);
  const [updatedMessage, setUpdatedMessage] = useState<any>(null);
  const [deletedMessageEvent, setDeletedMessageEvent] = useState<any>(null);
  const [reactionUpdate, setReactionUpdate] = useState<any>(null);
  const [typingStatus, setTypingStatus] = useState<any>(null);
  const [statusUpdate, setStatusUpdate] = useState<any>(null);

  useEffect(() => {
    const callbackId = 'messaging_hook';
    registerCallback(callbackId, (data) => {
      if (data.type === 'NEW_MESSAGE') {
        setLatestMessage(data.message);
      } else if (data.type === 'MESSAGE_EDITED') {
        setUpdatedMessage(data.message);
      } else if (data.type === 'MESSAGE_DELETED') {
        setDeletedMessageEvent(data);
      } else if (data.type === 'MESSAGE_REACTION') {
        setReactionUpdate(data);
      } else if (data.type === 'TYPING_STATUS') {
        setTypingStatus(data);
      } else if (data.type === 'MESSAGE_STATUS_UPDATE') {
        setStatusUpdate(data);
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

  return {
    isConnected,
    latestMessage,
    updatedMessage,
    deletedMessageEvent,
    reactionUpdate,
    typingStatus,
    statusUpdate,
    viewConversation,
    leaveConversation
  };
};
