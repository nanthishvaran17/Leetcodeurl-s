import React, { useState, useEffect, useRef } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  
  const [currentUserStr, setCurrentUserStr] = useState<string>('');
  
  // Polling interval
  const pollingRef = useRef<number | null>(null);

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

  const fetchConversations = async () => {
    try {
      const res = await axios.get(getApiUrl('/messaging/conversations'), { headers: getAuthHeaders() });
      if (res.data?.success) {
        setConversations(res.data.conversations);
      }
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await axios.get(getApiUrl(`/messaging/conversations/${conversationId}/messages`), {
        headers: getAuthHeaders()
      });
      if (res.data?.success) {
        setMessages(res.data.messages);
        
        // Optimistically clear unread count for this conversation
        setConversations(prev => prev.map(c => 
          c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c
        ));
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  // WebSocket Integration
  const { isConnected, latestMessage, viewConversation, leaveConversation } = useMessagingWebSocket(token);

  useEffect(() => {
    if (isConnected) {
      if (activeConversationId) {
        viewConversation(activeConversationId);
      } else {
        leaveConversation();
      }
    }
    return () => leaveConversation();
  }, [activeConversationId, viewConversation, leaveConversation, isConnected]);

  useEffect(() => {
    if (latestMessage) {
      const msg = latestMessage;
      
      // Update conversations list summary
      setConversations(prev => {
        let updated = false;
        const mapped = prev.map(c => {
          if (c.conversationId === msg.conversationId) {
            updated = true;
            return {
              ...c,
              lastMessagePreview: msg.content,
              lastMessageAt: msg.createdAt,
              // Only increment unread if we aren't actively viewing it
              unreadCount: activeConversationId === msg.conversationId && msg.senderId !== currentUserStr 
                ? c.unreadCount 
                : (msg.senderId !== currentUserStr ? c.unreadCount + 1 : c.unreadCount)
            };
          }
          return c;
        });
        
        return updated 
          ? mapped.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime())
          : prev; // Ideally we'd fetch the new conversation if it wasn't in the list
      });

      // Update active chat if viewing this conversation
      if (activeConversationId === msg.conversationId) {
        setMessages(prev => {
          // Deduplicate
          if (prev.some(p => p.messageId === msg.messageId)) return prev;
          return [...prev, msg];
        });
        
        // If we are viewing it and it's from someone else, we just read it
        if (msg.senderId !== currentUserStr) {
          axios.put(getApiUrl(`/messaging/conversations/${msg.conversationId}/read`), {}, { headers: getAuthHeaders() }).catch(() => {});
        }
      }
    }
  }, [latestMessage, activeConversationId, currentUserStr]);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, []);
  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    setIsMessagesLoading(true);
    await fetchMessages(id);
    setIsMessagesLoading(false);
  };

  const handleSendMessage = async (content: string, attachmentFileId?: string) => {
    if (!activeConversationId) return;
    
    const conv = conversations.find(c => c.conversationId === activeConversationId);
    if (!conv) return;

    try {
      const payload: any = {
        content,
        receiver_id: conv.otherUser.id
      };
      if (attachmentFileId) {
        payload.attachment_file_id = attachmentFileId;
      }
      const res = await axios.post(getApiUrl('/messaging/messages'), payload, { headers: getAuthHeaders() });
      
      if (res.data?.success) {
        setMessages(prev => [...prev, res.data.message]);
        setConversations(prev => prev.map(c => 
          c.conversationId === activeConversationId 
            ? { ...c, lastMessagePreview: content, lastMessageAt: new Date().toISOString() }
            : c
        ).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()));
      }
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const handleSelectRecipient = async (recipientId: string) => {
    setIsSelectorOpen(false);
    
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

  return (
    <div className="flex h-[calc(100dvh-56px)] sm:h-[calc(100dvh-68px)] md:h-[calc(100vh-5rem)] bg-white dark:bg-navy-950 sm:rounded-2xl overflow-hidden shadow-lg shadow-black/5 dark:shadow-none border border-slate-200 dark:border-slate-800/60 pb-[env(safe-area-inset-bottom,0px)]">
      
      {/* ZONE 1: Smart Inbox (Hidden on mobile if chat is active) */}
      <div className={`w-full md:w-[320px] lg:w-[380px] shrink-0 ${activeConversationId ? 'hidden md:block' : 'block'}`}>
        <ConversationList 
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNewMessage={() => setIsSelectorOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* ZONE 2: Main Chat Area */}
      <div className={`flex-1 min-w-0 flex flex-col bg-white dark:bg-navy-950 ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <ChatWindow 
          conversation={activeConv}
          messages={messages}
          currentUserId={currentUserStr}
          onSend={handleSendMessage}
          onBack={() => {
            setActiveConversationId(null);
            setShowInfoPanel(false);
          }}
          isLoading={isMessagesLoading}
          onToggleInfo={() => setShowInfoPanel(prev => !prev)}
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

      {/* Profile Panel Overlay for Tablet/Mobile */}
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
          onClose={() => setIsSelectorOpen(false)}
          onSelect={handleSelectRecipient}
        />
      )}
    </div>
  );
};

