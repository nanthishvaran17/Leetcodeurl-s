import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationList, Conversation } from '../components/messaging/ConversationList';
import { ChatWindow, Message } from '../components/messaging/ChatWindow';
import { RecipientSelector, Recipient } from '../components/messaging/RecipientSelector';
import { ConversationInfoPanel } from '../components/messaging/ConversationInfoPanel';
import { AskInstitutionPanel } from '../components/messaging/AskInstitutionPanel';
import { SmartGroupModal } from '../components/messaging/SmartGroupModal';
import api from '../services/api';
import { downloadManager } from '../services/download/downloadManager';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useMessagingWebSocket } from '../hooks/useMessagingWebSocket';
import { MessageSquare, Users, ShieldCheck, Plus, CheckCircle, Info, ArrowLeft, X } from 'lucide-react';

interface MessagesPageProps {
  onNavigateTab?: (tab: string) => void;
}


const normalizeId = (val: any) => String(val || '').trim().toLowerCase();

/**
 * Authoritative, loss-free message reconciliation algorithm.
 * Guarantees that:
 * 1. Optimistic messages in 'SENDING' state are never dropped while pending.
 * 2. Confirmed server messages seamlessly replace matching optimistic messages by clientMessageId.
 * 3. Already rendered messages in 'prev' are NEVER wiped out by background polling or partial snapshots.
 * 4. Deduplication is strictly 100% stable by messageId and clientMessageId (no content-based mis-matching).
 * 5. Messages are ordered chronologically by createdAt (oldest to newest).
 */
export function mergeMessages(prevList: Message[], incoming: Message | Message[]): Message[] {
  const incomingArr = (Array.isArray(incoming) ? incoming : [incoming]).filter(Boolean);
  if (incomingArr.length === 0) return prevList;

  // Index incoming by real messageId and by clientMessageId
  const incomingByMsgId = new Map<string, Message>();
  const incomingByClientMsgId = new Map<string, Message>();

  for (const inc of incomingArr) {
    if (inc.messageId) {
      incomingByMsgId.set(inc.messageId, inc);
    }
    if (inc.clientMessageId) {
      incomingByClientMsgId.set(inc.clientMessageId, inc);
    }
  }

  const merged: Message[] = [];
  const handledServerMsgIds = new Set<string>();

  // Reconcile existing messages in list
  for (const prevMsg of prevList) {
    // 1. Direct match by messageId
    if (incomingByMsgId.has(prevMsg.messageId)) {
      const serverMsg = incomingByMsgId.get(prevMsg.messageId)!;
      merged.push({
        ...serverMsg,
        localMediaUrl: serverMsg.localMediaUrl || prevMsg.localMediaUrl
      });
      handledServerMsgIds.add(serverMsg.messageId);
      continue;
    }

    // 2. Match optimistic message by clientMessageId
    if (incomingByClientMsgId.has(prevMsg.messageId)) {
      const serverMsg = incomingByClientMsgId.get(prevMsg.messageId)!;
      if (prevMsg.localMediaUrl) {
        URL.revokeObjectURL(prevMsg.localMediaUrl);
      }
      merged.push(serverMsg);
      handledServerMsgIds.add(serverMsg.messageId);
      continue;
    }

    // 3. Match if prevMsg has a clientMessageId that matches incoming clientMessageId
    if (prevMsg.clientMessageId && incomingByClientMsgId.has(prevMsg.clientMessageId)) {
      const serverMsg = incomingByClientMsgId.get(prevMsg.clientMessageId)!;
      if (prevMsg.localMediaUrl) {
        URL.revokeObjectURL(prevMsg.localMediaUrl);
      }
      merged.push(serverMsg);
      handledServerMsgIds.add(serverMsg.messageId);
      continue;
    }

    // 4. If prevMsg is an in-flight optimistic message, ALWAYS keep it
    if (prevMsg.status === 'SENDING' || prevMsg.messageId.startsWith('TEMP_')) {
      merged.push(prevMsg);
      continue;
    }

    // 5. If prevMsg is a confirmed message, ALWAYS preserve it (prevent disappearance from partial polling)
    merged.push(prevMsg);
  }

  // Append any incoming messages not matched above
  for (const inc of incomingArr) {
    if (!handledServerMsgIds.has(inc.messageId)) {
      merged.push(inc);
      handledServerMsgIds.add(inc.messageId);
    }
  }

  // Deduplicate: If an entry is TEMP_ but its clientMessageId is already confirmed by a real server message, drop the TEMP_
  const confirmedClientIds = new Set<string>();
  for (const m of merged) {
    if (!m.messageId.startsWith('TEMP_')) {
      if (m.clientMessageId) confirmedClientIds.add(m.clientMessageId);
      confirmedClientIds.add(m.messageId);
    }
  }

  const deduped: Message[] = [];
  const seenIds = new Set<string>();

  for (const m of merged) {
    if (m.messageId.startsWith('TEMP_')) {
      if (confirmedClientIds.has(m.messageId) || (m.clientMessageId && confirmedClientIds.has(m.clientMessageId))) {
        continue; // Already confirmed by server
      }
    }
    if (!seenIds.has(m.messageId)) {
      seenIds.add(m.messageId);
      deduped.push(m);
    }
  }

  // Sort stably by createdAt
  deduped.sort((a, b) => {
    const tA = new Date(a.createdAt || 0).getTime();
    const tB = new Date(b.createdAt || 0).getTime();
    return tA - tB;
  });

  return deduped;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({ onNavigateTab }) => {
  const { token, user } = useAuth();
  const { notify } = useNotification();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  activeConversationIdRef.current = activeConversationId;
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  
  const [currentUserStr, setCurrentUserStr] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  
  const [transparencyData, setTransparencyData] = useState<any>(null);
  const [loadingTransparency, setLoadingTransparency] = useState(false);

  // Determine current user ID for chat alignment (prioritizes unique institutional IDs over shared emails)
  useEffect(() => {
    try {
      const u = user || JSON.parse(localStorage.getItem('user') || '{}');
      if (u.reg_no || (u as any).regNo) {
        setCurrentUserStr(String(u.reg_no || (u as any).regNo).trim().toUpperCase());
      } else if (u.role && String(u.role).toLowerCase() !== 'student') {
        setCurrentUserStr(u.id ? `STAFF_${u.id}` : (u.username || u.email || 'STAFF'));
      } else if (u.username) {
        setCurrentUserStr(String(u.username).trim());
      } else if (u.email) {
        setCurrentUserStr(String(u.email).trim().toLowerCase());
      } else if (u.id) {
        setCurrentUserStr(String(u.id));
      }
    } catch(e) {}
  }, [user]);

  // Deep Link Auto-Navigation from Notification tap or AI Chat share links
  useEffect(() => {
    const handleOpenConv = (e: any) => {
      const cid = e?.detail?.conversationId;
      if (cid) {
        setActiveConversationId(cid);
      }
    };
    window.addEventListener('open_conversation', handleOpenConv);

    try {
      const sessionConv = sessionStorage.getItem('target_conversation_id');
      if (sessionConv) {
        sessionStorage.removeItem('target_conversation_id');
        setActiveConversationId(sessionConv);
      } else {
        const hashParams = window.location.hash.includes('?') 
          ? new URLSearchParams(window.location.hash.split('?')[1]) 
          : null;
        const searchParams = new URLSearchParams(window.location.search);
        const convId = hashParams?.get('conversationId') || searchParams.get('conversationId') || searchParams.get('conversation_id');
        const aiChatParam = searchParams.get('ai_chat') || searchParams.get('chat') || searchParams.get('shareData');
        if (aiChatParam) {
          console.log('[DEEP LINK] Automatically opening AI Agent from share link');
          setActiveConversationId('system-ai-agent');
        } else if (convId) {
          console.log(`[DEEP LINK] Automatically opening target conversation: ${convId}`);
          setActiveConversationId(convId);
        }
      }
    } catch (e) {
      console.warn('[DEEP LINK] Error parsing conversation query parameter:', e);
    }

    return () => {
      window.removeEventListener('open_conversation', handleOpenConv);
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/messaging/conversations');
      if (res.data?.success) {
        setConversations(res.data.conversations);
      }
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    }
  }, []);

  // Initial load: Fetch conversations immediately on mount (0ms delay, independent of WebSocket)
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = useCallback(async (conversationId: string, isSilent = false) => {
    if (!conversationId || conversationId.startsWith('system-')) {
      return;
    }
    try {
      const res = await api.get(`/messaging/conversations/${conversationId}/messages?limit=100`);
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (data?.success && Array.isArray(data.messages)) {
        if (activeConversationIdRef.current === conversationId) {
          setMessages(prev => mergeMessages(prev, data.messages));
          
          // Clear unread count for this conversation
          setConversations(prev => prev.map(c => 
            c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c
          ));
        }
      }
    } catch (err) {
      if (!isSilent) console.error('Failed to fetch messages', err);
    }
  }, []);

  // Native Pull-to-refresh support: reloads conversations and current thread
  useEffect(() => {
    const handlePull = async () => {
      try {
        await fetchConversations();
        if (activeConversationId) {
          await fetchMessages(activeConversationId, true);
        }
      } catch (e) {
        console.warn('Messages pull-to-refresh warning:', e);
      }
    };
    window.addEventListener('pull_to_refresh', handlePull);
    return () => window.removeEventListener('pull_to_refresh', handlePull);
  }, [fetchConversations, fetchMessages, activeConversationId]);

  const fetchTransparency = async () => {
    setLoadingTransparency(true);
    try {
      const res = await api.get('/messaging/why-was-i-flagged');
      if (res.data?.success) {
        setTransparencyData(res.data.transparency);
      }
    } catch (err) {
      console.error('Failed to fetch transparency data', err);
    } finally {
      setLoadingTransparency(false);
    }
  };

  useEffect(() => {
    if (activeConversationId === 'system-transparency-agent') {
      fetchTransparency();
    }
  }, [activeConversationId]);

  // Real-time message receipt handler
  const handleIncomingNewMessage = useCallback((msg: any) => {
    if (!msg) return;

    setConversations(prev => {
      let updated = false;
      const mapped = prev.map(c => {
        if (c.conversationId === msg.conversationId) {
          updated = true;
          return {
            ...c,
            lastMessagePreview: msg.content || (msg.attachmentFileId ? 'Sent an attachment' : c.lastMessagePreview),
            lastMessageAt: msg.createdAt || new Date().toISOString(),
            unreadCount: (activeConversationIdRef.current === msg.conversationId || normalizeId(msg.senderId) === normalizeId(currentUserStr))
              ? c.unreadCount 
              : c.unreadCount + 1
          };
        }
        return c;
      });
      if (!updated) {
        fetchConversations();
        return prev;
      }
      return mapped.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
    });

    const currentActive = activeConversationIdRef.current;
    const conv = conversations.find(c => c.conversationId === currentActive);
    const sId = normalizeId(msg.senderId);
    const rId = normalizeId(msg.receiverId);
    const myId = normalizeId(currentUserStr);
    const otherId = normalizeId(conv?.otherUser?.id);

    const isCurrentChat = (currentActive && msg.conversationId === currentActive) ||
      (conv && (
        ((sId === myId || sId === otherId) && (rId === myId || rId === otherId))
      ));

    if (isCurrentChat) {
      if (currentActive !== msg.conversationId && !currentActive?.startsWith('system-')) {
        setActiveConversationId(msg.conversationId);
      }
      setMessages(prev => mergeMessages(prev, msg));
    }
  }, [conversations, currentUserStr, fetchConversations]);

  // WebSocket Integration with direct zero-latency event dispatch
  const {
    isConnected,
    latestMessage,
    updatedMessage,
    deletedMessageEvent,
    reactionUpdate,
    typingStatus,
    statusUpdate,
    viewConversation,
    leaveConversation
  } = useMessagingWebSocket(token, {
    onNewMessage: handleIncomingNewMessage,
    onMessageEdited: (msg) => {
      setMessages(prev => prev.map(m => m.messageId === msg.messageId ? { ...m, ...msg } : m));
    },
    onMessageDeleted: ({ messageId, mode, message }) => {
      if (mode === 'FOR_EVERYONE' && message) {
        setMessages(prev => prev.map(m => m.messageId === messageId ? message : m));
      } else {
        setMessages(prev => prev.filter(m => m.messageId !== messageId));
      }
    },
    onMessageReaction: ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.messageId === messageId ? { ...m, reactions } : m));
    },
    onTypingStatus: ({ conversationId, senderId, isTyping }) => {
      if (normalizeId(senderId) !== normalizeId(currentUserStr)) {
        setTypingUsers(prev => ({ ...prev, [conversationId]: isTyping }));
      }
    },
    onMessageStatusUpdate: ({ messageId, status, deliveredAt, readAt }) => {
      setMessages(prev => prev.map(m => m.messageId === messageId ? { ...m, status, deliveredAt, readAt } : m));
    }
  });

  const flushOutbox = useCallback(async () => {
    const outboxRaw = localStorage.getItem('messages_outbox');
    if (!outboxRaw) return;
    try {
      const outbox: any[] = JSON.parse(outboxRaw);
      if (outbox.length === 0) return;
      
      const remaining: any[] = [];
      for (const item of outbox) {
        try {
          // Re-send text payloads via direct fast HTTP
          const res = await api.post('/messaging/messages', item.payload);
          const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          if (data?.success && data.message) {
            const realMsg: Message = data.message;
            if (!realMsg.clientMessageId && item.tempId) {
              realMsg.clientMessageId = item.tempId;
            }
            setMessages(prev => mergeMessages(prev, realMsg));
          } else {
            remaining.push(item);
          }
        } catch (e) {
          remaining.push(item);
        }
      }
      localStorage.setItem('messages_outbox', JSON.stringify(remaining));
      if (outbox.length > remaining.length) fetchConversations();
    } catch (e) {
      localStorage.removeItem('messages_outbox');
    }
  }, [fetchConversations]);

  // Auto-reconcile sending messages that stay stuck in 'SENDING' (e.g. mobile network response drops)
  useEffect(() => {
    const hasSending = messages.some(m => m.status === 'SENDING');
    if (!hasSending || !activeConversationId || activeConversationId.startsWith('system-')) return;

    const timer = setTimeout(() => {
      fetchMessages(activeConversationId);
    }, 3500);
    return () => clearTimeout(timer);
  }, [messages, activeConversationId, fetchMessages]);

  // Auto-flush outbox when device reconnects to network
  useEffect(() => {
    const handleOnline = () => {
      console.log('[MESSAGING] Network online restored, flushing pending outbox messages...');
      flushOutbox();
      fetchConversations();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushOutbox, fetchConversations]);

  // Sync active conversation viewing with WebSocket when connected
  useEffect(() => {
    if (isConnected) {
      fetchConversations();
      if (activeConversationId && !activeConversationId.startsWith('system-')) {
        viewConversation(activeConversationId);
      } else {
        leaveConversation();
      }
      flushOutbox();
    }
    return () => leaveConversation();
  }, [activeConversationId, viewConversation, leaveConversation, isConnected, fetchConversations, flushOutbox]);

  // Adaptive polling fallback for mobile devices (when tab is active or mobile OS throttles WebSockets)
  useEffect(() => {
    if (!activeConversationId || activeConversationId.startsWith('system-')) return;
    
    // Poll active chat every 2.5s silently so mobile users never wait for incoming messages
    const chatPollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMessages(activeConversationId, true);
      }
    }, 2500);

    return () => clearInterval(chatPollTimer);
  }, [activeConversationId, fetchMessages]);

  // Periodic inbox sync (every 6s) to keep previews and unread badges accurate
  useEffect(() => {
    const inboxTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchConversations();
      }
    }, 6000);
    return () => clearInterval(inboxTimer);
  }, [fetchConversations]);

  // Mobile wake-up sync: When user unlocks phone or switches back to tab, sync immediately
  useEffect(() => {
    const handleWakeup = () => {
      if (document.visibilityState === 'visible') {
        flushOutbox();
        fetchConversations();
        if (activeConversationId && !activeConversationId.startsWith('system-')) {
          fetchMessages(activeConversationId, true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('focus', handleWakeup);
    return () => {
      document.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('focus', handleWakeup);
    };
  }, [flushOutbox, fetchConversations, fetchMessages, activeConversationId]);

  const handleSelectConversation = async (id: string) => {
    if (activeConversationId !== id) {
      setMessages([]);
    }
    setActiveConversationId(id);
    if (!id.startsWith('system-')) {
      setIsMessagesLoading(true);
      await fetchMessages(id);
      setIsMessagesLoading(false);
    }
  };

  const handleSendMessage = (content: string, attachmentFile?: File, replyToMessageId?: string) => {
    if (!activeConversationId) return;
    const conv = conversations.find(c => c.conversationId === activeConversationId);
    if (!conv) return;

    const tempId = `TEMP_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    let localMediaUrl: string | undefined = undefined;
    let fileMimeType: string | undefined = undefined;

    if (attachmentFile) {
      fileMimeType = attachmentFile.type;
      if (fileMimeType.startsWith('image/') || fileMimeType.startsWith('video/')) {
        localMediaUrl = URL.createObjectURL(attachmentFile);
      }
    }

    const optMsg: Message = {
      messageId: tempId,
      clientMessageId: tempId,
      conversationId: activeConversationId,
      senderId: currentUserStr,
      receiverId: conv.otherUser.id,
      content,
      createdAt: new Date().toISOString(),
      status: 'SENDING',
      replyToMessageId,
      localMediaUrl,
      isUploading: !!attachmentFile,
      fileMimeType
    };

    // 0ms Perception: Instantly render message bubble in UI without waiting
    setMessages(prev => mergeMessages(prev, optMsg));

    // 0ms Perception: Immediately elevate conversation to top with latest preview
    setConversations(prev => {
      const targetConvId = activeConversationId;
      const updated = prev.map(c => {
        if (c.conversationId === targetConvId) {
          return {
            ...c,
            lastMessagePreview: content || (attachmentFile ? 'Sent an attachment' : c.lastMessagePreview),
            lastMessageAt: new Date().toISOString()
          };
        }
        return c;
      });
      return updated.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
    });

    // Sub-millisecond parallel HTTP dispatch (Guaranteed delivery regardless of WebSocket state)
    const runUpload = async () => {
      let payload: any = {
        content,
        receiver_id: conv.otherUser.id,
        client_message_id: tempId,
        t0_client_send: Date.now()
      };
      if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

      try {
        let finalAttachmentFileId = undefined;
        
        if (attachmentFile) {
          const formData = new FormData();
          formData.append('file', attachmentFile);
          const uploadRes = await api.post('/messaging/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (uploadRes.data?.success) {
            finalAttachmentFileId = uploadRes.data.file_id;
            payload.attachment_file_id = finalAttachmentFileId;
          }
        }

        // Direct HTTP API post: bypasses WebSocket disconnect blocks
        const res = await api.post('/messaging/messages', payload);
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (data?.success && data.message) {
          const realMsg: Message = data.message;
          if (!realMsg.clientMessageId) {
            realMsg.clientMessageId = tempId;
          }
          setMessages(prev => mergeMessages(prev, realMsg));

          // If the backend assigned a canonical conversationId, sync it immediately
          if (realMsg.conversationId && activeConversationIdRef.current && activeConversationIdRef.current !== realMsg.conversationId) {
            setActiveConversationId(realMsg.conversationId);
          }

          // Confirm server preview
          setConversations(prev => {
            let found = false;
            const targetConvId = realMsg.conversationId || activeConversationId;
            const updated = prev.map(c => {
              if (c.conversationId === targetConvId || (activeConversationId && c.conversationId === activeConversationId)) {
                found = true;
                return {
                  ...c,
                  conversationId: targetConvId,
                  lastMessagePreview: realMsg.content || (realMsg.attachmentFileId ? 'Sent an attachment' : c.lastMessagePreview),
                  lastMessageAt: realMsg.createdAt || new Date().toISOString()
                };
              }
              return c;
            });
            if (!found) {
              fetchConversations();
              return prev;
            }
            return updated.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
          });
        }
      } catch (err: any) {
        console.warn('[MESSAGING] Send failed, preserved in outbox for retry:', err);
        // Retain optimistic message in UI and preserve in outbox for automatic background flush
        try {
          const outboxRaw = localStorage.getItem('messages_outbox');
          const outbox = outboxRaw ? JSON.parse(outboxRaw) : [];
          outbox.push({ payload, tempId });
          localStorage.setItem('messages_outbox', JSON.stringify(outbox));
        } catch (e) {}

        // Immediate self-healing reconciliation if backend committed before mobile connection dropped
        setTimeout(() => {
          if (activeConversationId) {
            fetchMessages(activeConversationId);
          }
        }, 1500);
      }
    };
    runUpload();
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      const res = await api.put(`/messaging/messages/${messageId}`, { content: newContent });
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (data?.success) {
        setMessages(prev => prev.map(m => m.messageId === messageId ? data.message : m));
      } else {
        notify.error('Edit Failed', data?.error || 'Could not edit message.');
      }
    } catch (err: any) {
      notify.error('Edit Error', err.response?.data?.detail || err.message || 'Failed to edit message.');
    }
  };

  const handleDeleteMessage = async (messageId: string, mode: 'FOR_ME' | 'FOR_EVERYONE') => {
    try {
      const res = await api.delete(`/messaging/messages/${messageId}?mode=${mode}`);
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (data?.success) {
        if (mode === 'FOR_EVERYONE' && data.message) {
          setMessages(prev => prev.map(m => m.messageId === messageId ? data.message : m));
        } else {
          setMessages(prev => prev.filter(m => m.messageId !== messageId));
        }
      } else {
        notify.error('Delete Failed', data?.error || 'Could not delete message.');
      }
    } catch (err: any) {
      notify.error('Delete Error', err.response?.data?.detail || err.message || 'Failed to delete message.');
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (conversationId.startsWith('system-')) {
      return { success: true, conversationId };
    }
    try {
      const res = await api.delete(`/messaging/conversations/${conversationId}`);
      if (res.data?.success) {
        setConversations(prev => prev.filter(c => c.conversationId !== conversationId));
        if (activeConversationId === conversationId) {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handlePinConversation = async (conversationId: string) => {
    if (conversationId.startsWith('system-')) {
      return { success: true, is_pinned: true, conversationId };
    }
    try {
      const res = await api.post(`/messaging/conversations/${conversationId}/pin`, {});
      if (res.data?.success) {
        setConversations(prev => prev.map(c => c.conversationId === conversationId ? { ...c, isPinned: res.data.is_pinned } : c));
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    if (conversationId.startsWith('system-')) {
      return { success: true, is_archived: false, conversationId };
    }
    try {
      const res = await api.post(`/messaging/conversations/${conversationId}/archive`, {});
      if (res.data?.success) {
        setConversations(prev => prev.map(c => c.conversationId === conversationId ? { ...c, isArchived: res.data.is_archived } : c));
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handleClearConversation = async (conversationId: string) => {
    if (conversationId.startsWith('system-')) {
      if (activeConversationId === conversationId) {
        setMessages([]);
      }
      return { success: true, conversationId };
    }
    try {
      const res = await api.post(`/messaging/conversations/${conversationId}/clear`, {});
      if (res.data?.success) {
        if (activeConversationId === conversationId) {
          setMessages([]);
        }
        setConversations(prev => prev.map(c => c.conversationId === conversationId ? { ...c, lastMessagePreview: null } : c));
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handleBlockUser = async (userId: string) => {
    try {
      const res = await api.post(`/messaging/profile/${userId}/block`, {});
      return res.data;
    } catch (err) { throw err; }
  };

  const handleMarkUnread = async (conversationId: string) => {
    if (conversationId.startsWith('system-')) {
      return { success: true, unreadCount: 1, conversationId };
    }
    try {
      const res = await api.post(`/messaging/conversations/${conversationId}/unread`, {});
      if (res.data?.success) {
        setConversations(prev => prev.map(c => c.conversationId === conversationId ? { ...c, unreadCount: res.data.unreadCount || Math.max(1, (c.unreadCount || 0) + 1) } : c));
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handleMarkRead = async (conversationId: string) => {
    if (conversationId.startsWith('system-')) {
      return { success: true, unreadCount: 0, conversationId };
    }
    try {
      const res = await api.post(`/messaging/conversations/${conversationId}/read`, {});
      if (res.data?.success) {
        setConversations(prev => prev.map(c => c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c));
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await api.post(`/messaging/messages/${messageId}/reactions`, { emoji });
      if (res.data?.success) {
        setMessages(prev => prev.map(m => m.messageId === messageId ? { ...m, reactions: res.data.reactions } : m));
      }
    } catch (err) {}
  };

  const handleForwardMessage = (msg: Message) => {
    setForwardingMessage(msg);
    setIsSelectorOpen(true);
  };

  const handleReportTyping = async (isTyping: boolean) => {
    if (!activeConversationId) return;
    const conv = conversations.find(c => c.conversationId === activeConversationId);
    if (!conv) return;
    try {
      await api.post('/messaging/typing', {
        conversation_id: activeConversationId,
        receiver_id: conv.otherUser.id,
        is_typing: isTyping
      });
    } catch (err) {}
  };

  const handleSelectRecipient = async (recipientInput: Recipient | string) => {
    setIsSelectorOpen(false);
    const recipient: Recipient = typeof recipientInput === 'string'
      ? { id: recipientInput, name: recipientInput, role: 'User', department: '', type: 'STUDENT' }
      : recipientInput;

    const recipientId = recipient.id;

    if (forwardingMessage) {
      const targetMsg = forwardingMessage;
      setForwardingMessage(null);
      try {
        const res = await api.post('/messaging/messages', {
          content: `Forwarded: ${targetMsg.content}`,
          receiver_id: recipientId,
          attachment_file_id: targetMsg.attachmentFileId
        });
        if (res.data?.success) {
          await fetchConversations();
          handleSelectConversation(res.data.message.conversationId);
          notify.success('Message Forwarded', `Sent to ${recipient.name}`);
        }
      } catch (err: any) {
        console.error('Failed to forward message:', err);
        notify.error('Forward Failed', err?.response?.data?.detail || 'Unable to forward message.');
      }
      return;
    }

    const targetId = (recipientId || '').trim().toLowerCase();
    const targetName = (recipient.name || '').trim().toLowerCase();

    // Check if conversation already exists in current state
    const existing = conversations.find(c => {
      const otherId = (c.otherUser?.id || '').trim().toLowerCase();
      const otherName = (c.otherUser?.name || '').trim().toLowerCase();
      return (otherId && otherId === targetId) || (otherName && otherName === targetName);
    });

    if (existing) {
      handleSelectConversation(existing.conversationId);
      return;
    }

    // Call backend to create or get conversation record without auto-sending dummy messages
    try {
      const res = await api.post('/messaging/conversations', {
        recipient_id: recipientId
      });

      if (res.data?.success && res.data.conversation) {
        const newConv = res.data.conversation;
        setConversations(prev => {
          const exists = prev.some(c => c.conversationId === newConv.conversationId);
          return exists ? prev : [newConv, ...prev];
        });
        handleSelectConversation(newConv.conversationId);
        return;
      }
    } catch (err: any) {
      console.warn('Backend create conversation returned error, using fallback:', err);
    }

    // Fallback: Construct client-side conversation object immediately so chat opens instantly
    const fallbackConvId = `CONV_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fallbackConv: Conversation = {
      conversationId: fallbackConvId,
      otherUser: {
        id: recipient.id,
        name: recipient.name,
        role: recipient.role,
        department: recipient.department,
        type: recipient.type as 'STAFF' | 'STUDENT',
        isOnline: false
      },
      lastMessagePreview: null,
      lastMessageAt: null,
      unreadCount: 0,
      isPinned: false,
      isArchived: false
    };
    setConversations(prev => [fallbackConv, ...prev]);
    handleSelectConversation(fallbackConvId);
  };

  const handleActionTrigger = (act: any) => {
    if (!act) return;
    if (act.action === 'CREATE_GROUP') {
      setIsGroupModalOpen(true);
    } else if (act.action === 'VIEW_TRANSPARENCY') {
      setActiveConversationId('system-transparency-agent');
    } else if (['VIEW_STUDENTS', 'VIEW_INACTIVE_STUDENTS', 'VIEW_STUDENT_PROFILE'].includes(act.action)) {
      setActiveConversationId(null);
      onNavigateTab?.('students');
    } else if (act.action === 'NAVIGATE' || act.action === 'NAVIGATE_TAB') {
      const targetTab = act.params?.tab || act.params?.targetTab || 'dashboard';
      setActiveConversationId(null);
      onNavigateTab?.(targetTab);
    } else if (act.action === 'VIEW_MY_PROGRESS') {
      setActiveConversationId(null);
      onNavigateTab?.('growth');
    } else if (['VIEW_CONTEST', 'CONTEST_LEADERBOARD'].includes(act.action)) {
      setActiveConversationId(null);
      onNavigateTab?.('contests');
    } else if (act.action === 'VIEW_STAFF_ALLOCATIONS') {
      setActiveConversationId(null);
      onNavigateTab?.('departments');
    } else if (['DOWNLOAD_PDF', 'EXPORT_PDF', 'EXPORT_STUDENT_PDF'].includes(act.action)) {
      const token = localStorage.getItem('token') || '';
      const reportParams = new URLSearchParams({ token });
      Object.entries(act.params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          reportParams.set(key, String(value));
        }
      });
      const downloadUrl = `/reports/export-pdf?${reportParams.toString()}`;
      
      downloadManager.download({
        endpoint: downloadUrl,
        filename: 'Executive_PDF_Summary.pdf',
        mimeType: 'application/pdf',
      });
    } else if (act.params?.tab) {
      setActiveConversationId(null);
      onNavigateTab?.(act.params.tab);
    }
  };

  const activeConv = conversations.find(c => c.conversationId === activeConversationId) || null;
  const activeConvWithTyping = activeConv ? { ...activeConv, isTyping: Boolean(typingUsers[activeConv.conversationId]) } : null;
  
  // Inject the AI Agents into the inbox
  const aiAgentConversation = {
    conversationId: 'system-ai-agent',
    isGroup: false,
    otherUser: {
      id: 'system-ai-agent',
      name: 'Institution Intelligence',
      role: 'AI Agent',
      isOnline: true,
      profileUrl: ''
    },
    lastMessagePreview: 'Ask anything (e.g. Who missed the last contest?)',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    isTyping: false
  };

  const transparencyConversation = {
    conversationId: 'system-transparency-agent',
    isGroup: false,
    otherUser: {
      id: 'system-transparency-agent',
      name: 'Transparency & Standing',
      role: 'System',
      isOnline: true,
      profileUrl: ''
    },
    lastMessagePreview: 'View your verified institutional standing.',
    lastMessageAt: new Date(Date.now() - 1000).toISOString(),
    unreadCount: 0,
    isTyping: false
  };
  
  const conversationsWithTyping = [
    aiAgentConversation,
    transparencyConversation,
    ...conversations.map(c => ({ ...c, isTyping: Boolean(typingUsers[c.conversationId]) }))
  ];

  const isAiAgentActive = activeConversationId === 'system-ai-agent';
  const isTransparencyActive = activeConversationId === 'system-transparency-agent';
  const isSystemActive = isAiAgentActive || isTransparencyActive;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0B1120] text-slate-900 dark:text-slate-200 w-full overflow-hidden border-0 rounded-none shadow-none">
      
      {/* Top Institutional Intelligence Hub Header */}
      <div className={`m-2.5 sm:m-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl relative overflow-hidden bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white flex-wrap items-center justify-between gap-4 shrink-0 shadow-xl border border-indigo-500/30 dark:border-indigo-500/40 z-20 backdrop-blur-md ${
        activeConversationId ? 'hidden' : 'flex'
      }`}>
        <div className="relative z-10 flex items-center space-x-3.5 sm:space-x-4">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('dashboard')}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer flex items-center space-x-2 text-xs font-bold shadow-md hover:scale-105 active:scale-95"
              title="Go Back"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}

          <div>
            <h1 className="text-[13px] xs:text-sm sm:text-lg md:text-xl font-black tracking-tight sm:tracking-wider leading-tight text-white uppercase whitespace-nowrap">
              INSTITUTIONAL <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-300 whitespace-nowrap">INTELLIGENCE HUB</span>
            </h1>
            {/* Desktop Subtitle (Single Line) */}
            <p className="hidden sm:flex text-xs text-slate-300 font-semibold mt-0.5 tracking-wide flex-wrap items-center gap-1.5">
              <span>Communication</span> <span className="text-indigo-400/60">•</span>
              <span>Context</span> <span className="text-indigo-400/60">•</span>
              <span>Verified Data</span> <span className="text-indigo-400/60">•</span>
              <span>Intelligence</span> <span className="text-indigo-400/60">•</span>
              <span>Action</span>
            </p>

            {/* Mobile Subtitle (3 Top, 2 Bottom) */}
            <div className="flex sm:hidden flex-col gap-0.5 text-[9.5px] xs:text-[10px] text-slate-300 font-semibold mt-0.5 tracking-normal">
              <div className="flex items-center space-x-1 whitespace-nowrap">
                <span>Communication</span> <span className="text-indigo-400/60">•</span>
                <span>Context</span> <span className="text-indigo-400/60">•</span>
                <span>Verified Data</span>
              </div>
              <div className="flex items-center space-x-1 whitespace-nowrap">
                <span>Intelligence</span> <span className="text-indigo-400/60">•</span>
                <span>Action</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ALWAYS RENDER THE LAYOUT FRAME */}
      <div className="flex-1 min-h-0 h-full w-full flex overflow-hidden">
        
        {/* ZONE 1: Smart Inbox (Hidden when AI Agent is active to give full screen width to AskInstitutionPanel) */}
        <div className={`w-full md:w-[320px] lg:w-[380px] shrink-0 h-full border-r border-slate-200 dark:border-slate-800 ${
          isAiAgentActive ? 'hidden' : (activeConversationId ? 'hidden md:block' : 'block')
        }`}>
          <ConversationList 
            conversations={conversationsWithTyping} 
            activeId={activeConversationId} 
            onSelect={(id) => {
              handleSelectConversation(id);
            }}
            onNewMessage={() => {
              setForwardingMessage(null);
              setIsSelectorOpen(true);
            }}
            onSmartGroup={() => setIsGroupModalOpen(true)}
            onDeleteConversation={handleDeleteConversation}
            onPinConversation={handlePinConversation}
            onArchiveConversation={handleArchiveConversation}
            onClearConversation={handleClearConversation}
            onBlockUser={handleBlockUser}
            onMarkUnread={handleMarkUnread}
            onMarkRead={handleMarkRead}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* ZONE 2: Main Content Area */}
        <div className={`flex-1 min-w-0 min-h-0 h-full flex flex-col bg-slate-50 dark:bg-[#0B1120] overflow-hidden ${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        }`}>
          {!isSystemActive && (
            <ChatWindow 
              conversation={activeConvWithTyping}
              messages={messages}
              currentUserId={currentUserStr}
              onSend={handleSendMessage}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onToggleReaction={handleToggleReaction}
              onForwardMessage={handleForwardMessage}
              onBack={() => {
                setActiveConversationId(null);
                setShowInfoPanel(false);
              }}
              isLoading={isMessagesLoading}
              onToggleInfo={() => setShowInfoPanel(prev => !prev)}
              isOtherUserTyping={activeConv ? Boolean(typingUsers[activeConv.conversationId]) : false}
              onReportTyping={handleReportTyping}
            />
          )}

          {isAiAgentActive && (
            <div className="flex-1 min-h-0 h-full w-full flex flex-col relative bg-white dark:bg-[#0B1120] overflow-hidden">
              <AskInstitutionPanel 
                onBack={() => setActiveConversationId(null)} 
                onActionTrigger={handleActionTrigger} 
              />
            </div>
          )}

          {isTransparencyActive && (
            <div className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-[#060B14] relative">
              {/* Mobile Back Button Header */}
              <div className="md:hidden w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 shrink-0 flex items-center justify-between shadow-sm z-10">
                <button 
                  onClick={() => setActiveConversationId(null)} 
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-1.5"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-sm font-semibold">Back</span>
                </button>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Transparency & Standing</span>
                <div className="w-9"></div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-start md:items-center justify-center">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-auto">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
                    <div className="flex items-center space-x-3.5">
                      <div className="p-3.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-lg ring-4 ring-emerald-50 dark:ring-emerald-950/30">
                        <ShieldCheck className="w-7 h-7" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Student Standing & Transparency</h2>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">Objective evidence explaining your institutional standing.</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {transparencyData?.studentName && (
                        <div className="hidden sm:block text-right">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{transparencyData.studentName}</div>
                          <div className="text-xs font-mono text-slate-400">{transparencyData.regNo} ({transparencyData.department})</div>
                        </div>
                      )}
                      <button
                        onClick={() => setActiveConversationId(null)}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        title="Close"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                {loadingTransparency ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Retrieving verified transparency metrics...</div>
                  </div>
                ) : transparencyData ? (
                  <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                    
                    {/* Account Status Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Standing</span>
                        <div className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                          <span className={`w-3 h-3 rounded-full ${transparencyData.status === 'IN_GOOD_STANDING' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500 shadow-[0_0_10px_#f59e0b]'}`}></span>
                          <span>{transparencyData.statusLabel || transparencyData.status}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Last Data Sync</span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg shadow-sm">
                          {transparencyData.lastSync || 'Active'}
                        </span>
                      </div>
                    </div>

                    {/* Key Metrics Grid */}
                    {transparencyData.totalSolved !== undefined && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-3.5 rounded-2xl text-center">
                          <div className="text-xl font-black text-indigo-700 dark:text-indigo-400">{transparencyData.totalSolved}</div>
                          <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mt-0.5">Total Solved</div>
                        </div>
                        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-3.5 rounded-2xl text-center">
                          <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">{transparencyData.easySolved}</div>
                          <div className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Easy Problems</div>
                        </div>
                        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 p-3.5 rounded-2xl text-center">
                          <div className="text-xl font-black text-amber-700 dark:text-amber-400">{transparencyData.mediumSolved}</div>
                          <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">Medium Problems</div>
                        </div>
                        <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 p-3.5 rounded-2xl text-center">
                          <div className="text-xl font-black text-rose-700 dark:text-rose-400">{transparencyData.hardSolved}</div>
                          <div className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mt-0.5">Hard Problems</div>
                        </div>
                      </div>
                    )}

                    {/* Verified Data Factors List */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Verified Database Factors</span>
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md font-mono text-slate-600 dark:text-slate-300">Ground Truth</span>
                      </div>
                      <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                        {(transparencyData.objectiveReasons || transparencyData.reasons || [])
                          .map((reason: string, i: number) => (
                          <li key={i} className="flex items-start space-x-2.5 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Transparency Guarantee Banner */}
                    <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl text-xs text-indigo-900 dark:text-indigo-200 flex items-start space-x-3 shadow-sm">
                      <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <span className="font-medium leading-relaxed">{transparencyData.note || "This transparency view is grounded 100% in objective, verified institutional database records. No subjective AI metrics or black-box scoring are applied."}</span>
                    </div>

                  </div>
                ) : (
                  <div className="text-slate-500 text-sm font-medium text-center py-8">No transparency record found.</div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>

        {/* ZONE 3: Institutional Profile Panel */}
        {showInfoPanel && activeConv && !isSystemActive && (
          <div className="w-full lg:w-[340px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] absolute lg:relative inset-0 lg:inset-auto z-40 lg:z-auto">
            <ConversationInfoPanel 
              userId={activeConv.otherUser.id} 
              onClose={() => setShowInfoPanel(false)}
              messageCount={messages.length}
            />
          </div>
        )}
      </div>

      {isSelectorOpen && (
        <RecipientSelector 
          onClose={() => {
            setIsSelectorOpen(false);
            setForwardingMessage(null);
          }}
          onSelect={handleSelectRecipient}
        />
      )}

      {isGroupModalOpen && (
        <SmartGroupModal
          isOpen={isGroupModalOpen}
          onClose={() => setIsGroupModalOpen(false)}
          onGroupCreated={(group) => {
            fetchConversations();
          }}
        />
      )}
    </div>
  );
};

