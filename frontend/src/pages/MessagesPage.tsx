import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationList, Conversation } from '../components/messaging/ConversationList';
import { ChatWindow, Message } from '../components/messaging/ChatWindow';
import { RecipientSelector } from '../components/messaging/RecipientSelector';
import { ConversationInfoPanel } from '../components/messaging/ConversationInfoPanel';
import { AskInstitutionPanel } from '../components/messaging/AskInstitutionPanel';
import { SmartGroupModal } from '../components/messaging/SmartGroupModal';
import { getApiUrl, getAuthHeaders } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useMessagingWebSocket } from '../hooks/useMessagingWebSocket';
import axios from 'axios';
import { MessageSquare, Sparkles, Users, ShieldCheck, Plus, CheckCircle, Info, ArrowLeft } from 'lucide-react';

export const MessagesPage: React.FC = () => {
  const { token, user } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
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

  // Deep Link Auto-Navigation from Notification tap
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const convId = params.get('conversationId') || params.get('conversation_id');
      if (convId) {
        console.log(`[DEEP LINK] Automatically opening target conversation: ${convId}`);
        setActiveConversationId(convId);
      }
    } catch (e) {
      console.warn('[DEEP LINK] Error parsing conversation query parameter:', e);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await axios.get(getApiUrl('/messaging/conversations'), { headers: await getAuthHeaders() });
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
        headers: await getAuthHeaders()
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

  const fetchTransparency = async () => {
    setLoadingTransparency(true);
    try {
      const res = await axios.get(getApiUrl('/messaging/why-was-i-flagged'), { headers: await getAuthHeaders() });
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
      flushOutbox();
    }
    return () => leaveConversation();
  }, [activeConversationId, viewConversation, leaveConversation, isConnected, fetchConversations, fetchMessages]);

  const flushOutbox = async () => {
    const outboxRaw = localStorage.getItem('messages_outbox');
    if (!outboxRaw) return;
    try {
      const outbox: any[] = JSON.parse(outboxRaw);
      if (outbox.length === 0) return;
      
      const remaining = [];
      for (const item of outbox) {
        try {
          // Re-send text payloads
          const res = await axios.post(getApiUrl('/messaging/messages'), item.payload, { headers: await getAuthHeaders() });
          if (res.data?.success) {
            const realMsg = res.data.message;
            setMessages(prev => prev.map(m => m.messageId === item.tempId ? realMsg : m));
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
  };

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
          if (prev.some(p => p.messageId === msg.messageId)) return prev;
          const tempIdx = prev.findIndex(p =>
            p.messageId.startsWith('TEMP_') &&
            (msg.clientMessageId
              ? p.messageId === msg.clientMessageId
              : (p.senderId === msg.senderId && p.content === msg.content))
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = msg;
            return updated;
          }
          return [...prev, msg];
        });
      }
    }
  }, [latestMessage, activeConversationId, currentUserStr, fetchConversations]);

  // Handle MESSAGE_EDITED, DELETED, REACTION, TYPING
  useEffect(() => {
    if (updatedMessage) {
      setMessages(prev => prev.map(m => m.messageId === updatedMessage.messageId ? updatedMessage : m));
    }
  }, [updatedMessage]);

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

  useEffect(() => {
    if (reactionUpdate) {
      const { messageId, reactions } = reactionUpdate;
      setMessages(prev => prev.map(m => m.messageId === messageId ? { ...m, reactions } : m));
    }
  }, [reactionUpdate]);

  useEffect(() => {
    if (typingStatus) {
      const { conversationId, senderId, isTyping } = typingStatus;
      if (senderId !== currentUserStr) {
        setTypingUsers(prev => ({ ...prev, [conversationId]: isTyping }));
      }
    }
  }, [typingStatus, currentUserStr]);

  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    setIsMessagesLoading(true);
    await fetchMessages(id);
    setIsMessagesLoading(false);
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

    setMessages(prev => [...prev, optMsg]);

    // Fire and forget (or queue if offline)
    const runUpload = async () => {
      try {
        let finalAttachmentFileId = undefined;
        
        if (attachmentFile) {
          const formData = new FormData();
          formData.append('file', attachmentFile);
          const uploadRes = await axios.post(getApiUrl('/messaging/upload'), formData, {
            headers: {
              ...await getAuthHeaders(),
              'Content-Type': 'multipart/form-data'
            }
          });
          if (uploadRes.data?.success) {
            finalAttachmentFileId = uploadRes.data.file_id;
          }
        }

        const payload: any = { content, receiver_id: conv.otherUser.id, client_message_id: tempId, t0_client_send: Date.now() };
        if (finalAttachmentFileId) payload.attachment_file_id = finalAttachmentFileId;
        if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

        if (!isConnected && !attachmentFile) {
          // Queue text message to outbox
          const outboxRaw = localStorage.getItem('messages_outbox');
          const outbox = outboxRaw ? JSON.parse(outboxRaw) : [];
          outbox.push({ payload, tempId });
          localStorage.setItem('messages_outbox', JSON.stringify(outbox));
          return;
        }

        const res = await axios.post(getApiUrl('/messaging/messages'), payload, { headers: await getAuthHeaders() });
        if (res.data?.success) {
          const realMsg = res.data.message;
          setMessages(prev => prev.map(m => {
            if (m.messageId === tempId) {
              if (m.localMediaUrl) URL.revokeObjectURL(m.localMediaUrl);
              return realMsg;
            }
            return m;
          }));
          fetchConversations();
        }
      } catch (err) {
        // If it fails (e.g. network drops during upload), fallback to filter
        setMessages(prev => prev.filter(m => m.messageId !== tempId));
        // Optionally trigger a toast error here
      }
    };
    runUpload();
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      const res = await axios.put(getApiUrl(`/messaging/messages/${messageId}`), { content: newContent }, { headers: await getAuthHeaders() });
      if (res.data?.success) {
        setMessages(prev => prev.map(m => m.messageId === messageId ? res.data.message : m));
      }
    } catch (err) {}
  };

  const handleDeleteMessage = async (messageId: string, mode: 'FOR_ME' | 'FOR_EVERYONE') => {
    try {
      const res = await axios.delete(getApiUrl(`/messaging/messages/${messageId}?mode=${mode}`), { headers: await getAuthHeaders() });
      if (res.data?.success) {
        if (mode === 'FOR_EVERYONE' && res.data.message) {
          setMessages(prev => prev.map(m => m.messageId === messageId ? res.data.message : m));
        } else {
          setMessages(prev => prev.filter(m => m.messageId !== messageId));
        }
      }
    } catch (err) {}
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (conversationId.startsWith('system-')) {
      return { success: true, conversationId };
    }
    try {
      const res = await axios.delete(getApiUrl(`/messaging/conversations/${conversationId}`), { headers: await getAuthHeaders() });
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
      const res = await axios.post(getApiUrl(`/messaging/conversations/${conversationId}/pin`), {}, { headers: await getAuthHeaders() });
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
      const res = await axios.post(getApiUrl(`/messaging/conversations/${conversationId}/archive`), {}, { headers: await getAuthHeaders() });
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
      const res = await axios.post(getApiUrl(`/messaging/conversations/${conversationId}/clear`), {}, { headers: await getAuthHeaders() });
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
      const res = await axios.post(getApiUrl(`/messaging/profile/${userId}/block`), {}, { headers: await getAuthHeaders() });
      return res.data;
    } catch (err) { throw err; }
  };

  const handleMarkUnread = async (conversationId: string) => {
    if (conversationId.startsWith('system-')) {
      return { success: true, unreadCount: 1, conversationId };
    }
    try {
      const res = await axios.post(getApiUrl(`/messaging/conversations/${conversationId}/unread`), {}, { headers: await getAuthHeaders() });
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
      const res = await axios.post(getApiUrl(`/messaging/conversations/${conversationId}/read`), {}, { headers: await getAuthHeaders() });
      if (res.data?.success) {
        setConversations(prev => prev.map(c => c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c));
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await axios.post(getApiUrl(`/messaging/messages/${messageId}/reactions`), { emoji }, { headers: await getAuthHeaders() });
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
      await axios.post(getApiUrl('/messaging/typing'), {
        conversation_id: activeConversationId,
        receiver_id: conv.otherUser.id,
        is_typing: isTyping
      }, { headers: await getAuthHeaders() });
    } catch (err) {}
  };

  const handleSelectRecipient = async (recipientId: string) => {
    setIsSelectorOpen(false);
    if (forwardingMessage) {
      const targetMsg = forwardingMessage;
      setForwardingMessage(null);
      try {
        const res = await axios.post(getApiUrl('/messaging/messages'), {
          content: `Forwarded: ${targetMsg.content}`,
          receiver_id: recipientId,
          attachment_file_id: targetMsg.attachmentFileId
        }, { headers: await getAuthHeaders() });
        if (res.data?.success) {
          await fetchConversations();
          handleSelectConversation(res.data.message.conversationId);
        }
      } catch (err) {}
      return;
    }

    const existing = conversations.find(c => c.otherUser.id === recipientId);
    if (existing) {
      handleSelectConversation(existing.conversationId);
      return;
    }
    try {
      const res = await axios.post(getApiUrl('/messaging/messages'), {
        content: 'Hello',
        receiver_id: recipientId
      }, { headers: await getAuthHeaders() });
      if (res.data?.success) {
        await fetchConversations();
        handleSelectConversation(res.data.message.conversationId);
      }
    } catch (err) {}
  };

  const handleActionTrigger = (act: any) => {
    if (act.action === 'CREATE_GROUP') {
      setIsGroupModalOpen(true);
    } else if (act.action === 'VIEW_TRANSPARENCY') {
      setActiveConversationId('system-transparency-agent');
    } else if (['DOWNLOAD_PDF', 'EXPORT_PDF', 'EXPORT_STUDENT_PDF'].includes(act.action)) {
      const token = localStorage.getItem('token') || '';
      const downloadUrl = `${getApiUrl('/reports/export-pdf')}?token=${token}`;
      window.open(downloadUrl, '_blank');
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
    <div className="flex flex-col h-[calc(100dvh-56px)] sm:h-[calc(100dvh-68px)] md:h-[calc(100vh-5rem)] bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-200 sm:rounded-2xl overflow-hidden shadow-2xl dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-800">
      
      {/* Top Institutional Intelligence Hub Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white px-6 py-5 sm:py-6 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-lg border-b border-brand-500/30 z-20">
        <div className="relative z-10 flex items-center space-x-4">
          <div className="w-12 h-12 bg-brand-500/20 rounded-2xl flex items-center justify-center border border-brand-400/30 shadow-inner shrink-0">
            <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-wider leading-tight text-white uppercase">
              INSTITUTIONAL <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">INTELLIGENCE HUB</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-bold mt-1 tracking-wide">
              Communication <span className="text-brand-400/60 px-1.5">•</span> Context <span className="text-brand-400/60 px-1.5">•</span> Verified Data <span className="text-brand-400/60 px-1.5">•</span> Intelligence <span className="text-brand-400/60 px-1.5">•</span> Action
            </p>
          </div>
        </div>
      </div>

      {/* ALWAYS RENDER THE LAYOUT FRAME */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        
        {/* ZONE 1: Smart Inbox (Always visible on desktop, conditionally hidden on mobile if in chat) */}
        <div className={`w-full md:w-[320px] lg:w-[380px] shrink-0 border-r border-slate-200 dark:border-slate-800 ${
          activeConversationId ? 'hidden md:block' : 'block'
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
        <div className={`flex-1 min-w-0 flex flex-col bg-slate-50 dark:bg-[#0B1120] ${
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
            <div className="flex-1 min-h-0 flex flex-col relative bg-white">
               {/* Mobile back button header */}
               <div className="md:hidden w-full bg-white border-b border-slate-200 p-3 shrink-0 flex items-center shadow-sm">
                  <button onClick={() => setActiveConversationId(null)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                     <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="ml-3 flex items-center space-x-2">
                     <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                     </div>
                     <span className="font-bold text-slate-800">Institution Intelligence</span>
                  </div>
               </div>
               <div className="flex-1 min-h-0 w-full flex flex-col">
                 <AskInstitutionPanel onActionTrigger={handleActionTrigger} />
               </div>
            </div>
          )}

          {isTransparencyActive && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 dark:bg-[#060B14] flex items-center justify-center">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6">
                
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
                  {transparencyData?.studentName && (
                    <div className="hidden sm:block text-right">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{transparencyData.studentName}</div>
                      <div className="text-xs font-mono text-slate-400">{transparencyData.regNo} ({transparencyData.department})</div>
                    </div>
                  )}
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
          )}
        </div>

        {/* ZONE 3: Institutional Profile Panel */}
        {showInfoPanel && activeConv && !isSystemActive && (
          <div className="hidden lg:block w-[340px] shrink-0 border-l border-slate-200 bg-white">
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

