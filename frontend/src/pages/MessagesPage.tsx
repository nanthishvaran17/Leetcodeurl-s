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
import { MessageSquare, Sparkles, Users, ShieldCheck, Plus, CheckCircle, Info } from 'lucide-react';

export const MessagesPage: React.FC = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'COMMUNICATION' | 'ASK_INSTITUTION' | 'TRANSPARENCY'>('COMMUNICATION');
  
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
            p.senderId === msg.senderId &&
            p.content === msg.content
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

  const handleSendMessage = async (content: string, attachmentFileId?: string, replyToMessageId?: string) => {
    if (!activeConversationId) return;
    const conv = conversations.find(c => c.conversationId === activeConversationId);
    if (!conv) return;

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
      const payload: any = { content, receiver_id: conv.otherUser.id };
      if (attachmentFileId) payload.attachment_file_id = attachmentFileId;
      if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

      const res = await axios.post(getApiUrl('/messaging/messages'), payload, { headers: getAuthHeaders() });
      if (res.data?.success) {
        const realMsg = res.data.message;
        setMessages(prev => prev.map(m => m.messageId === tempId ? realMsg : m));
        fetchConversations();
      }
    } catch (err) {
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
      setActiveTab('TRANSPARENCY');
      fetchTransparency();
    } else if (act.action === 'VIEW_STUDENTS') {
      setActiveTab('COMMUNICATION');
    }
  };

  const activeConv = conversations.find(c => c.conversationId === activeConversationId) || null;
  const activeConvWithTyping = activeConv ? { ...activeConv, isTyping: Boolean(typingUsers[activeConv.conversationId]) } : null;
  const conversationsWithTyping = conversations.map(c => ({ ...c, isTyping: Boolean(typingUsers[c.conversationId]) }));

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] sm:h-[calc(100dvh-68px)] md:h-[calc(100vh-5rem)] bg-slate-950 text-slate-100 sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      
      {/* Top Institutional Intelligence Hub Header */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              INSTITUTIONAL INTELLIGENCE HUB
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              Communication → Context → Verified Data → Intelligence → Action → Outcome
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('COMMUNICATION')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'COMMUNICATION' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Communication</span>
          </button>
          
          <button
            onClick={() => setActiveTab('ASK_INSTITUTION')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'ASK_INSTITUTION' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Ask Institution</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('TRANSPARENCY');
              fetchTransparency();
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'TRANSPARENCY' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Transparency</span>
          </button>

          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium text-slate-300 hover:bg-slate-800 transition border-l border-slate-800 ml-1"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Smart Group</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT VIEWS */}
      {activeTab === 'ASK_INSTITUTION' && (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
          <AskInstitutionPanel onActionTrigger={handleActionTrigger} />
        </div>
      )}

      {activeTab === 'TRANSPARENCY' && (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Student Standing & Transparency</h2>
                <p className="text-xs text-slate-400">Objective evidence explaining your institutional standing.</p>
              </div>
            </div>

            {loadingTransparency ? (
              <div className="text-center py-8 text-slate-400 text-sm">Loading verified transparency data...</div>
            ) : transparencyData ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-200">
                  Account Status: <span className="text-emerald-400 font-bold">{transparencyData.status}</span>
                </div>
                
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Verified Data Factors</div>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {transparencyData.objectiveReasons?.map((reason: string, i: number) => (
                      <li key={i} className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs text-indigo-200 flex items-center space-x-2">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{transparencyData.note}</span>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-sm">No transparency record found.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'COMMUNICATION' && (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* ZONE 1: Smart Inbox */}
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
          <div className={`flex-1 min-w-0 flex flex-col bg-slate-950 ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
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
            <div className="hidden lg:block w-[340px] shrink-0 border-l border-slate-800">
              <ConversationInfoPanel 
                userId={activeConv.otherUser.id} 
                onClose={() => setShowInfoPanel(false)}
                messageCount={messages.length}
              />
            </div>
          )}
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

