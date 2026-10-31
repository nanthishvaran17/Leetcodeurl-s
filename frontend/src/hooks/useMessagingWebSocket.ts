import { useState, useEffect, useCallback, useRef } from 'react';
import { useGlobalWebSocket } from '../context/GlobalWebSocketProvider';

export interface MessagingWebSocketCallbacks {
  onNewMessage?: (message: any) => void;
  onMessageEdited?: (message: any) => void;
  onMessageDeleted?: (event: any) => void;
  onMessageReaction?: (event: any) => void;
  onTypingStatus?: (event: any) => void;
  onMessageStatusUpdate?: (event: any) => void;
}

export const useMessagingWebSocket = (token: string | null, callbacks?: MessagingWebSocketCallbacks) => {
  const { isConnected, registerCallback, unregisterCallback, sendMessage } = useGlobalWebSocket();
  const [latestMessage, setLatestMessage] = useState<any>(null);
  const [updatedMessage, setUpdatedMessage] = useState<any>(null);
  const [deletedMessageEvent, setDeletedMessageEvent] = useState<any>(null);
  const [reactionUpdate, setReactionUpdate] = useState<any>(null);
  const [typingStatus, setTypingStatus] = useState<any>(null);
  const [statusUpdate, setStatusUpdate] = useState<any>(null);

  const callbacksRef = useRef<MessagingWebSocketCallbacks | undefined>(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const callbackId = 'messaging_hook';
    registerCallback(callbackId, (data) => {
      if (!data) return;
      if (data.type === 'NEW_MESSAGE') {
        if (callbacksRef.current?.onNewMessage) {
          try {
            callbacksRef.current.onNewMessage(data.message);
          } catch (e) {
            console.error('[WS Hook] onNewMessage error:', e);
          }
        }
        setLatestMessage({ ...data.message, _ws_id: Date.now() + Math.random() });
      } else if (data.type === 'MESSAGE_EDITED') {
        if (callbacksRef.current?.onMessageEdited) {
          try {
            callbacksRef.current.onMessageEdited(data.message);
          } catch (e) {
            console.error('[WS Hook] onMessageEdited error:', e);
          }
        }
        setUpdatedMessage({ ...data.message, _ws_id: Date.now() + Math.random() });
      } else if (data.type === 'MESSAGE_DELETED') {
        if (callbacksRef.current?.onMessageDeleted) {
          try {
            callbacksRef.current.onMessageDeleted(data);
          } catch (e) {
            console.error('[WS Hook] onMessageDeleted error:', e);
          }
        }
        setDeletedMessageEvent(data);
      } else if (data.type === 'MESSAGE_REACTION') {
        if (callbacksRef.current?.onMessageReaction) {
          try {
            callbacksRef.current.onMessageReaction(data);
          } catch (e) {
            console.error('[WS Hook] onMessageReaction error:', e);
          }
        }
        setReactionUpdate(data);
      } else if (data.type === 'TYPING_STATUS') {
        if (callbacksRef.current?.onTypingStatus) {
          try {
            callbacksRef.current.onTypingStatus(data);
          } catch (e) {
            console.error('[WS Hook] onTypingStatus error:', e);
          }
        }
        setTypingStatus(data);
      } else if (data.type === 'MESSAGE_STATUS_UPDATE') {
        if (callbacksRef.current?.onMessageStatusUpdate) {
          try {
            callbacksRef.current.onMessageStatusUpdate(data);
          } catch (e) {
            console.error('[WS Hook] onMessageStatusUpdate error:', e);
          }
        }
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
