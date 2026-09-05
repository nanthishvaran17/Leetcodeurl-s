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

  const fetchTransparency = async () => {
    setLoadingTransparency(true);
    try {
      const res = await axios.get(getApiUrl('/messaging/why-was-i-flagged'), { headers: getAuthHeaders() });
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
          const res = await axios.post(getApiUrl('/messaging/messages'), item.payload, { headers: getAuthHeaders() });
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
              ...getAuthHeaders(),
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

        const res = await axios.post(getApiUrl('/messaging/messages'), payload, { headers: getAuthHeaders() });
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
      const res = await axios.put(getApiUrl(`/messaging/messages/${messageId}`), { content: newContent }, { headers: getAuthHeaders() });
      if (res.data?.success) {
        setMessages(prev => prev.map(m => m.messageId === messageId ? res.data.message : m));
      }
    } catch (err) {}
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
    } catch (err) {}
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const res = await axios.delete(getApiUrl(`/messaging/conversations/${conversationId}`), { headers: getAuthHeaders() });
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
    try {
      const res = await axios.post(getApiUrl(`/messaging/conversations/${conversationId}/pin`), {}, { headers: getAuthHeaders() });
      if (res.data?.success) {
        setConversations(prev => prev.map(c => c.conversationId === conversationId ? { ...c, isPinned: res.data.is_pinned } : c));
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    try {
      const res = await axios.post(getApiUrl(`/messaging/conversations/${conversationId}/archive`), {}, { headers: getAuthHeaders() });
      if (res.data?.success) {
        // If the backend filters them out, we could refetch or just update state
        setConversations(prev => prev.map(c => c.conversationId === conversationId ? { ...c, isArchived: res.data.is_archived } : c));
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handleClearConversation = async (conversationId: string) => {
    try {
      const res = await axios.post(getApiUrl(`/messaging/conversations/${conversationId}/clear`), {}, { headers: getAuthHeaders() });
      if (res.data?.success && activeConversationId === conversationId) {
        setMessages([]);
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handleBlockUser = async (userId: string) => {
    try {
      const res = await axios.post(getApiUrl(`/messaging/profile/${userId}/block`), {}, { headers: getAuthHeaders() });
      return res.data;
    } catch (err) { throw err; }
  };

  const handleMarkUnread = async (conversationId: string) => {
    try {
      const res = await axios.post(getApiUrl(`/messaging/conversations/${conversationId}/unread`), {}, { headers: getAuthHeaders() });
      if (res.data?.success) {
        setConversations(prev => prev.map(c => c.conversationId === conversationId ? { ...c, unreadCount: Math.max(1, c.unreadCount) } : c));
      }
      return res.data;
    } catch (err) { throw err; }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await axios.post(getApiUrl(`/messaging/messages/${messageId}/reactions`), { emoji }, { headers: getAuthHeaders() });
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
      }, { headers: getAuthHeaders() });
    } catch (err) {}
  };

  const handleSelectRecipient = async (recipientId: string) => {
    setIsSelectorOpen(false);
    if (forwardingMessage) {
      const targetMsg = forwardingMessage;
      setForwardingMessage(null);
      try {
        const res = await axios.post(getApiUrl('/messaging/messages'), {
          content: `↪️ Forwarded: ${targetMsg.content}`,
          receiver_id: recipientId,
          attachment_file_id: targetMsg.attachmentFileId
        }, { headers: getAuthHeaders() });
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
      }, { headers: getAuthHeaders() });
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
      <div className="relative overflow-hidden bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-lg border-b border-brand-500/30 z-20">
        <div className="relative z-10 flex items-center space-x-3.5">
          <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center border border-brand-400/30">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-[15px] font-black tracking-widest leading-tight text-white uppercase">
              INSTITUTIONAL <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-teal-300 to-indigo-300">INTELLIGENCE HUB</span>
            </h1>
            <p className="text-[11px] text-slate-300 font-bold hidden sm:block mt-0.5 tracking-wide">
              Communication <span className="text-brand-400/50 px-1">•</span> Context <span className="text-brand-400/50 px-1">•</span> Verified Data <span className="text-brand-400/50 px-1">•</span> Intelligence <span className="text-brand-400/50 px-1">•</span> Action
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
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex items-center justify-center">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl w-full shadow-xl space-y-4">
                <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Student Standing & Transparency</h2>
                    <p className="text-xs text-slate-500 font-medium">Objective evidence explaining your institutional standing.</p>
                  </div>
                </div>

                {loadingTransparency ? (
                  <div className="text-center py-8 text-slate-400 text-sm font-medium animate-pulse">Loading verified transparency data...</div>
                ) : transparencyData ? (
                  <div className="space-y-3">
                    <div className="text-sm font-bold text-slate-700">
                      Account Status: <span className="text-emerald-600 font-black">{transparencyData.status}</span>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Verified Data Factors</div>
                      <ul className="space-y-2 text-xs text-slate-600 font-medium">
                        {transparencyData.objectiveReasons?.map((reason: string, i: number) => (
                          <li key={i} className="flex items-start space-x-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 flex items-center space-x-2 shadow-sm">
                      <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="font-medium">{transparencyData.note}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm font-medium text-center py-4">No transparency record found.</div>
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

