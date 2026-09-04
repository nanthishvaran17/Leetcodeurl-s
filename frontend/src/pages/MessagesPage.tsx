import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationList, Conversation } from '../components/messaging/ConversationList';
import { ChatWindow, Message } from '../components/messaging/ChatWindow';
import { RecipientSelector } from '../components/messaging/RecipientSelector';
import { ConversationInfoPanel } from '../components/messaging/ConversationInfoPanel';
import { getApiUrl, getAuthHeaders } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useMessagingWebSocket } from '../hooks/useMessagingWebSocket';
import axios from 'axios';

export const MessagesPage: React.FC = () => {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  
  const [currentUserStr, setCurrentUserStr] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});

  // Determine current user ID for chat alignment
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u.email) setCurrentUserStr(u.email);
      else if (u.reg_no) setCurrentUserStr(u.reg_no);
      else if (u.role) setCurrentUserStr(`STAFF_${u.id}`);
      else setCurrentUserStr(String(u.id));
    } catch(e) {}
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await axios.get(getApiUrl('/messaging/conversations'), { headers: getAuthHeaders() });
      if (res.data?.success) {
        setConversations(res.data.conversations);
      }
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await axios.get(getApiUrl(`/messaging/conversations/${conversationId}/messages`), {
        headers: getAuthHeaders()
      });
      if (res.data?.success) {
        const uniqueMsgs: Message[] = [];
        const seen = new Set<string>();
        (res.data.messages || []).forEach((m: Message) => {
          if (m?.messageId && !seen.has(m.messageId)) {
            seen.add(m.messageId);
            uniqueMsgs.push(m);
          }
        });
        setMessages(uniqueMsgs);
        
        // Clear unread count for this conversation
        setConversations(prev => prev.map(c => 
          c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c
        ));
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  }, []);

  // WebSocket Integration with all real-time events
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
  } = useMessagingWebSocket(token);

  useEffect(() => {
    if (isConnected) {
      fetchConversations();
      if (activeConversationId) {
        fetchMessages(activeConversationId);
        viewConversation(activeConversationId);
      } else {
        leaveConversation();
      }
    }
    return () => leaveConversation();
  }, [activeConversationId, viewConversation, leaveConversation, isConnected, fetchConversations, fetchMessages]);

  // Handle visibility change / app resume sync
  useEffect(() => {
    const handleSyncOnResume = () => {
      if (document.visibilityState === 'visible') {
        fetchConversations();
        if (activeConversationId) {
          fetchMessages(activeConversationId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleSyncOnResume);
    window.addEventListener('focus', handleSyncOnResume);

    return () => {
      document.removeEventListener('visibilitychange', handleSyncOnResume);
      window.removeEventListener('focus', handleSyncOnResume);
    };
  }, [fetchConversations, fetchMessages, activeConversationId]);

  // Handle incoming NEW_MESSAGE
  useEffect(() => {
    if (latestMessage) {
      const msg = latestMessage;
      
      setConversations(prev => {
        let updated = false;
        const mapped = prev.map(c => {
          if (c.conversationId === msg.conversationId) {
            updated = true;
            return {
              ...c,
              lastMessagePreview: msg.content,
              lastMessageAt: msg.createdAt,
              unreadCount: activeConversationId === msg.conversationId && msg.senderId !== currentUserStr 
                ? c.unreadCount 
                : (msg.senderId !== currentUserStr ? c.unreadCount + 1 : c.unreadCount)
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

      if (activeConversationId === msg.conversationId) {
        setMessages(prev => {
          // 1. If messageId already exists in state, skip to prevent duplicates
          if (prev.some(p => p.messageId === msg.messageId)) return prev;

          // 2. If this message matches an optimistic TEMP_ message from current user, replace the TEMP_ message
          const tempIdx = prev.findIndex(p =>
            p.messageId.startsWith('TEMP_') &&
            p.senderId === msg.senderId &&
            p.content === msg.content
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = msg;
            return updated;
          }

          // 3. Otherwise append new message
          return [...prev, msg];
        });
        
        if (msg.senderId !== currentUserStr) {
          axios.put(getApiUrl(`/messaging/conversations/${msg.conversationId}/read`), {}, { headers: getAuthHeaders() }).catch(() => {});
        }
      }
    }
  }, [latestMessage, activeConversationId, currentUserStr, fetchConversations]);

  // Handle MESSAGE_EDITED
  useEffect(() => {
    if (updatedMessage) {
      setMessages(prev => prev.map(m => m.messageId === updatedMessage.messageId ? updatedMessage : m));
      setConversations(prev => prev.map(c => {
        if (c.conversationId === updatedMessage.conversationId) {
          return { ...c, lastMessagePreview: updatedMessage.content };
        }
        return c;
      }));
    }
  }, [updatedMessage]);

  // Handle MESSAGE_DELETED
  useEffect(() => {
    if (deletedMessageEvent) {
      const { messageId, mode, message } = deletedMessageEvent;
      if (mode === 'FOR_EVERYONE' && message) {
        setMessages(prev => prev.map(m => m.messageId === messageId ? message : m));
      } else if (mode === 'FOR_ME') {
        setMessages(prev => prev.filter(m => m.messageId !== messageId));
      }
    }
  }, [deletedMessageEvent]);

  // Handle MESSAGE_REACTION
  useEffect(() => {
    if (reactionUpdate) {
      const { messageId, reactions } = reactionUpdate;
      setMessages(prev => prev.map(m => m.messageId === messageId ? { ...m, reactions } : m));
    }
  }, [reactionUpdate]);

  // Handle TYPING_STATUS
  useEffect(() => {
    if (typingStatus) {
      const { conversationId, senderId, isTyping } = typingStatus;
      if (senderId !== currentUserStr) {
        setTypingUsers(prev => ({ ...prev, [conversationId]: isTyping }));
      }
    }
  }, [typingStatus, currentUserStr]);

  // Handle MESSAGE_STATUS_UPDATE
  useEffect(() => {
    if (statusUpdate) {
      const { conversationId, status, messageIds } = statusUpdate;
      if (activeConversationId === conversationId) {
        setMessages(prev => prev.map(m => {
          if (messageIds && messageIds.includes(m.messageId)) {
            return { ...m, status };
          }
          if (!messageIds && m.senderId === currentUserStr) {
            return { ...m, status };
          }
          return m;
        }));
      }
    }
  }, [statusUpdate, activeConversationId, currentUserStr]);

  // Initial load & Deep Link check
  useEffect(() => {
    fetchConversations();

    // Check deep link via URL search param or hash
    const params = new URLSearchParams(window.location.search);
    const targetConv = params.get('conv') || params.get('conversation_id');
    if (targetConv) {
      handleSelectConversation(targetConv);
    }
  }, [fetchConversations]);

  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    setIsMessagesLoading(true);
    await fetchMessages(id);
    setIsMessagesLoading(false);
  };

  const handleSendMessage = async (content: string, attachmentFileId?: string, replyToMessageId?: string) => {
    if (!activeConversationId) return;
    
    const conv = conversations.find(c => c.conversationId === activeConversationId);
    if (!conv) return;

    // Optimistic message
    const tempId = `TEMP_${Date.now()}`;
    const optMsg: Message = {
      messageId: tempId,
      conversationId: activeConversationId,
      senderId: currentUserStr,
      receiverId: conv.otherUser.id,
      content,
      createdAt: new Date().toISOString(),
      status: 'SENDING',
      attachmentFileId,
      replyToMessageId
    };

    setMessages(prev => [...prev, optMsg]);

    try {
      const payload: any = {
        content,
        receiver_id: conv.otherUser.id
      };
      if (attachmentFileId) payload.attachment_file_id = attachmentFileId;
      if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

      const res = await axios.post(getApiUrl('/messaging/messages'), payload, { headers: getAuthHeaders() });
      
      if (res.data?.success) {
        const realMsg = res.data.message;
        setMessages(prev => {
          // If WebSocket already inserted the realMsg, just filter out tempId
          if (prev.some(m => m.messageId === realMsg.messageId)) {
            return prev.filter(m => m.messageId !== tempId);
          }
          // Otherwise replace tempId with realMsg
          return prev.map(m => m.messageId === tempId ? realMsg : m);
        });
        
        setConversations(prev => prev.map(c => 
          c.conversationId === activeConversationId 
            ? { ...c, lastMessagePreview: content, lastMessageAt: new Date().toISOString() }
            : c
        ).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()));
      }
    } catch (err) {
      console.error('Failed to send message', err);
      setMessages(prev => prev.filter(m => m.messageId !== tempId));
      throw err;
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      const res = await axios.put(getApiUrl(`/messaging/messages/${messageId}`), { content: newContent }, { headers: getAuthHeaders() });
      if (res.data?.success) {
        setMessages(prev => prev.map(m => m.messageId === messageId ? res.data.message : m));
      }
    } catch (err) {
      console.error('Edit error:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string, mode: 'FOR_ME' | 'FOR_EVERYONE') => {
    try {
      const res = await axios.delete(getApiUrl(`/messaging/messages/${messageId}?mode=${mode}`), { headers: getAuthHeaders() });
      if (res.data?.success) {
        if (mode === 'FOR_EVERYONE' && res.data.message) {
          setMessages(prev => prev.map(m => m.messageId === messageId ? res.data.message : m));
        } else {
          setMessages(prev => prev.filter(m => m.messageId !== messageId));
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await axios.post(getApiUrl(`/messaging/messages/${messageId}/reactions`), { emoji }, { headers: getAuthHeaders() });
      if (res.data?.success) {
        setMessages(prev => prev.map(m => m.messageId === messageId ? { ...m, reactions: res.data.reactions } : m));
      }
    } catch (err) {
      console.error('Reaction error:', err);
    }
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
      await axios.post(getApiUrl('/messaging/typing'), {
        conversation_id: activeConversationId,
        receiver_id: conv.otherUser.id,
        is_typing: isTyping
      }, { headers: getAuthHeaders() });
    } catch (err) {
      // Ignore typing report errors gracefully
    }
  };

  const handleSelectRecipient = async (recipientId: string) => {
    setIsSelectorOpen(false);

    if (forwardingMessage) {
      // Forwarding flow
      const targetMsg = forwardingMessage;
      setForwardingMessage(null);
      const forwardContent = `↪️ Forwarded: ${targetMsg.content}`;
      
      try {
        const res = await axios.post(getApiUrl('/messaging/messages'), {
          content: forwardContent,
          receiver_id: recipientId,
          attachment_file_id: targetMsg.attachmentFileId
        }, { headers: getAuthHeaders() });

        if (res.data?.success) {
          await fetchConversations();
          handleSelectConversation(res.data.message.conversationId);
        }
      } catch (err) {
        console.error('Forward failed', err);
      }
      return;
    }
    
    // Normal new message creation flow
    const existing = conversations.find(c => c.otherUser.id === recipientId);
    if (existing) {
      handleSelectConversation(existing.conversationId);
      return;
    }
    
    try {
      const res = await axios.post(getApiUrl('/messaging/messages'), {
        content: '👋 Hi',
        receiver_id: recipientId
      }, { headers: getAuthHeaders() });
      
      if (res.data?.success) {
        await fetchConversations();
        handleSelectConversation(res.data.message.conversationId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeConv = conversations.find(c => c.conversationId === activeConversationId) || null;

  // Augment active conversation with current typing status
  const activeConvWithTyping = activeConv
    ? { ...activeConv, isTyping: Boolean(typingUsers[activeConv.conversationId]) }
    : null;

  // Augment conversations list with current typing statuses
  const conversationsWithTyping = conversations.map(c => ({
    ...c,
    isTyping: Boolean(typingUsers[c.conversationId])
  }));

  return (
    <div className="flex h-[calc(100dvh-56px)] sm:h-[calc(100dvh-68px)] md:h-[calc(100vh-5rem)] bg-white dark:bg-navy-950 sm:rounded-2xl overflow-hidden shadow-lg shadow-black/5 dark:shadow-none border border-slate-200 dark:border-slate-800/60 pb-[env(safe-area-inset-bottom,0px)]">
      
      {/* ZONE 1: Smart Inbox (Hidden on mobile if chat is active) */}
      <div className={`w-full md:w-[320px] lg:w-[380px] shrink-0 ${activeConversationId ? 'hidden md:block' : 'block'}`}>
        <ConversationList 
          conversations={conversationsWithTyping}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNewMessage={() => {
            setForwardingMessage(null);
            setIsSelectorOpen(true);
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* ZONE 2: Main Chat Area */}
      <div className={`flex-1 min-w-0 flex flex-col bg-white dark:bg-navy-950 ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
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
      </div>

      {/* ZONE 3: Institutional Profile Panel */}
      {showInfoPanel && activeConv && (
        <div className="hidden lg:block w-[340px] shrink-0 border-l border-slate-200 dark:border-slate-800/60">
          <ConversationInfoPanel 
            userId={activeConv.otherUser.id} 
            onClose={() => setShowInfoPanel(false)}
            messageCount={messages.length}
          />
        </div>
      )}

      {/* Profile Panel Overlay for Mobile/Tablet Drawer */}
      {showInfoPanel && activeConv && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInfoPanel(false)} />
          <div className="relative w-full max-w-sm h-full shadow-2xl">
            <ConversationInfoPanel 
              userId={activeConv.otherUser.id} 
              onClose={() => setShowInfoPanel(false)}
              messageCount={messages.length}
            />
          </div>
        </div>
      )}

      {isSelectorOpen && (
        <RecipientSelector 
          onClose={() => {
            setIsSelectorOpen(false);
            setForwardingMessage(null);
          }}
          onSelect={handleSelectRecipient}
        />
      )}
    </div>
  );
};
