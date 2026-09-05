import React, { useState, useRef, useEffect } from 'react';
import {
  Send, ArrowLeft, Loader2, Info, Paperclip, Smile, Check, CheckCheck,
  MoreVertical, Reply, Edit2, Trash2, Copy, Share2, X, FileText, Download,
  CornerDownRight, ChevronDown, Sparkles, Palette
} from 'lucide-react';
import { clsx } from 'clsx';
import { Conversation } from './ConversationList';
import axios from 'axios';
import { getApiUrl, getAuthHeaders } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

export type ChatWallpaper = 'default' | 'emerald' | 'stealth' | 'cyber' | 'indigo' | 'doodle';

interface WallpaperOption {
  id: ChatWallpaper;
  name: string;
  swatchClass: string;
  bgClass: string;
  bubbleMeClass?: string;
  bubbleOtherClass?: string;
}

const CHAT_WALLPAPERS: WallpaperOption[] = [
  {
    id: 'default',
    name: 'Default Slate',
    swatchClass: 'bg-slate-400',
    bgClass: 'bg-slate-50 dark:bg-navy-950',
  },
  {
    id: 'emerald',
    name: 'WhatsApp Emerald',
    swatchClass: 'bg-emerald-500',
    bgClass: 'bg-[#efeae2] dark:bg-[#0b141a] bg-[radial-gradient(#00a88415_1px,transparent_1px)] [background-size:16px_16px]',
    bubbleMeClass: 'bg-[#005c4b] text-white shadow-emerald-900/10',
    bubbleOtherClass: 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100 border border-slate-200/50 dark:border-slate-800',
  },
  {
    id: 'stealth',
    name: 'Dark Stealth',
    swatchClass: 'bg-slate-900 border border-indigo-500',
    bgClass: 'bg-[#090d16] bg-[linear-gradient(to_right,#1f293d0f_1px,transparent_1px),linear-gradient(to_bottom,#1f293d0f_1px,transparent_1px)] [background-size:24px_24px]',
    bubbleMeClass: 'bg-indigo-600 text-white shadow-indigo-900/20',
    bubbleOtherClass: 'bg-[#151d2a] text-slate-100 border border-slate-800/80',
  },
  {
    id: 'cyber',
    name: 'Cyber Neon',
    swatchClass: 'bg-cyan-500',
    bgClass: 'bg-[#050b14] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))]',
    bubbleMeClass: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-cyan-500/20',
    bubbleOtherClass: 'bg-slate-900/90 text-cyan-100 border border-cyan-900/50',
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    swatchClass: 'bg-indigo-600',
    bgClass: 'bg-[#0f1123] bg-[radial-gradient(#4f46e520_1px,transparent_1px)] [background-size:20px_20px]',
    bubbleMeClass: 'bg-indigo-600 text-white shadow-indigo-950/40',
    bubbleOtherClass: 'bg-[#1a1c38] text-indigo-100 border border-indigo-950',
  },
  {
    id: 'doodle',
    name: 'Doodle Pattern',
    swatchClass: 'bg-teal-600',
    bgClass: 'bg-[#e5ddd5] dark:bg-[#111b21] bg-[radial-gradient(#64748b20_1px,transparent_1px)] [background-size:12px_12px]',
    bubbleMeClass: 'bg-[#008069] text-white shadow-teal-900/10',
    bubbleOtherClass: 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100 border border-slate-200/60 dark:border-slate-800',
  },
];

const LazyEmojiPicker = React.lazy(() => import('emoji-picker-react'));

export interface Message {
  messageId: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  status: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ';
  deliveredAt?: string;
  readAt?: string;
  editedAt?: string;
  isEdited?: boolean;
  isDeletedEveryone?: boolean;
  replyToMessageId?: string;
  replyToMessage?: {
    messageId: string;
    senderId: string;
    content: string;
    attachmentFileId?: string;
  };
  reactions?: Record<string, string>;
  attachmentFileId?: string;
  localMediaUrl?: string;
  isUploading?: boolean;
  fileMimeType?: string;
}

interface Props {
  conversation: Conversation | null;
  messages: Message[];
  currentUserId: string;
  onSend: (content: string, attachmentFile?: File, replyToMessageId?: string) => void | Promise<void>;
  onEditMessage: (messageId: string, newContent: string) => Promise<void>;
  onDeleteMessage: (messageId: string, mode: 'FOR_ME' | 'FOR_EVERYONE') => Promise<void>;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  onForwardMessage: (message: Message) => void;
  onBack: () => void;
  isLoading: boolean;
  onToggleInfo?: () => void;
  isOtherUserTyping?: boolean;
  onReportTyping?: (isTyping: boolean) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥'];

export const ChatWindow: React.FC<Props> = ({
  conversation,
  messages,
  currentUserId,
  onSend,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onForwardMessage,
  onBack,
  isLoading,
  onToggleInfo,
  isOtherUserTyping,
  onReportTyping
}) => {
  const { notify } = useNotification();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [chatWallpaper, setChatWallpaper] = useState<ChatWallpaper>(() => {
    return (localStorage.getItem('chat_wallpaper_theme') as ChatWallpaper) || 'default';
  });
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);

  const activeWallpaper = CHAT_WALLPAPERS.find(w => w.id === chatWallpaper) || CHAT_WALLPAPERS[0];

  const handleSelectWallpaper = (id: ChatWallpaper) => {
    setChatWallpaper(id);
    localStorage.setItem('chat_wallpaper_theme', id);
    setShowWallpaperMenu(false);
    notify.success('Chat Theme Updated', `Applied "${CHAT_WALLPAPERS.find(w => w.id === id)?.name}" theme to messaging interface.`, { category: 'MESSAGING' });
  };

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // For media preview
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFile && (selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/'))) {
      const url = URL.createObjectURL(selectedFile);
      setLocalPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setLocalPreviewUrl(null);
    }
  }, [selectedFile]);

  // Active Menu / Context state
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Typing debounce timer
  const typingTimerRef = useRef<any>(null);

  // Auto scroll behavior
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    
    if (isNearBottom || messages[messages.length - 1]?.senderId === currentUserId) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShowScrollBottom(false);
      setNewMessagesCount(0);
    } else {
      setShowScrollBottom(true);
      setNewMessagesCount(prev => prev + 1);
    }
  }, [messages, currentUserId]);

  // Handle scroll detection
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottom(!isNearBottom);
    if (isNearBottom) setNewMessagesCount(0);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#060B14] h-full p-6 text-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-50 rounded-full blur-[80px] pointer-events-none"></div>
        
        <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-800 relative z-10 group">
          <div className="absolute inset-0 bg-indigo-50 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <Send className="w-10 h-10 text-indigo-500 ml-1.5 opacity-90 group-hover:scale-110 transition-transform duration-500 relative z-10" />
        </div>
        <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight relative z-10">
          Institutional Connect
        </h3>
        <p className="text-slate-500 mt-4 text-[15px] max-w-sm leading-relaxed font-medium relative z-10">
          Select a conversation from your secure inbox or start a new message to connect with faculty and peers.
        </p>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    if (onReportTyping) {
      onReportTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        onReportTyping(false);
      }, 2000);
    }
  };

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = inputText.trim();
    const fileToSend = selectedFile;
    const replyMsg = replyingToMessage;
    const isEdit = !!editingMessage;
    const editMsgId = editingMessage?.messageId;

    if (!textToSend && !fileToSend) return;
    if (isSending) return;

    if (onReportTyping) onReportTyping(false);

    // Clear input box IMMEDIATELY for instant UI feedback
    setInputText('');
    setSelectedFile(null);
    setReplyingToMessage(null);
    setEditingMessage(null);
    setShowEmojiPicker(false);
    
    if (isEdit) {
      setIsSending(true);
    }

    try {
      if (isEdit && editMsgId) {
        // Edit mode
        await onEditMessage(editMsgId, textToSend);
      } else {
        // Normal send or Reply mode - zero blocking
        await onSend(
          textToSend,
          fileToSend || undefined,
          replyMsg ? replyMsg.messageId : undefined
        );
      }
    } catch (err: any) {
      // If error occurs, notify user and restore text so message isn't lost
      setInputText(textToSend);
      notify.error('Send Error', err?.response?.data?.detail || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleStartEdit = (msg: Message) => {
    setActiveMenuMessageId(null);
    setEditingMessage(msg);
    setReplyingToMessage(null);
    setInputText(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const handleCopyText = (text: string) => {
    setActiveMenuMessageId(null);
    navigator.clipboard.writeText(text);
    notify.success('Copied', 'Message text copied to clipboard.', { category: 'MESSAGING' });
  };

  const scrollToMessageId = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-brand-500', 'ring-offset-2', 'transition-all');
      setTimeout(() => el.classList.remove('ring-2', 'ring-brand-500', 'ring-offset-2'), 2000);
    }
  };

  const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      return new Date(dateStr + 'Z');
    }
    return new Date(dateStr);
  };

  const formatTime = (dateStr: string) => {
    return parseSafeDate(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatHeaderDate = (dateStr: string) => {
    const d = parseSafeDate(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={clsx("flex-1 w-full flex flex-col h-full relative overflow-hidden transition-all duration-300", activeWallpaper.bgClass)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl md:hidden transition-colors cursor-pointer"
            title="Back to inbox"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative cursor-pointer group" onClick={onToggleInfo}>
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-brand-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105">
              <span className="text-white font-black text-lg md:text-xl">
                {conversation.otherUser.name.charAt(0).toUpperCase()}
              </span>
            </div>
            {conversation.otherUser.isOnline && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-navy-950 rounded-full" title="Online now" />
            )}
          </div>

          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
              <span>{conversation.otherUser.name}</span>
              <span className={clsx(
                "text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider",
                conversation.otherUser.type === 'STAFF'
                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30"
                  : "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/30"
              )}>
                {conversation.otherUser.role}
              </span>
            </h3>

            {isOtherUserTyping ? (
              <p className="text-xs text-emerald-500 font-extrabold italic animate-pulse flex items-center gap-1">
                <span>typing...</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400 font-medium">
                {conversation.otherUser.department} • {conversation.otherUser.isOnline ? '🟢 Online' : 'Offline'}
              </p>
            )}
          </div>
        </div>

        {/* Header Actions: Theme Switcher & Info */}
        <div className="flex items-center gap-1 relative">
          <button
            onClick={() => setShowWallpaperMenu(prev => !prev)}
            className={clsx(
              "p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-extrabold",
              showWallpaperMenu
                ? "bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title="Chat Theme & Wallpaper"
          >
            <Palette className="w-5 h-5 text-brand-500" />
            <span className="hidden sm:inline text-[11px]">{activeWallpaper.name}</span>
          </button>

          {/* Wallpaper Selection Dropdown */}
          {showWallpaperMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#151b23] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 p-2 space-y-1 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 mb-1 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Chat Wallpaper Theme
                </span>
                <button onClick={() => setShowWallpaperMenu(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {CHAT_WALLPAPERS.map((wp) => (
                <button
                  key={wp.id}
                  onClick={() => handleSelectWallpaper(wp.id)}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    chatWallpaper === wp.id
                      ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={clsx("w-3 h-3 rounded-full shrink-0 shadow-xs", wp.swatchClass)} />
                    <span>{wp.name}</span>
                  </div>
                  {chatWallpaper === wp.id && (
                    <Check className="w-4 h-4 text-brand-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {onToggleInfo && (
            <button
              onClick={onToggleInfo}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Institutional Profile Info"
            >
              <Info className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll View */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-6 flex flex-col custom-scrollbar relative z-10"
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-400 py-16 flex flex-col items-center">
            <div className="w-14 h-14 bg-brand-50 dark:bg-brand-950/40 rounded-2xl flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7 text-brand-500" />
            </div>
            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">Start an encrypted institutional dialogue!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUserId;
            const isMenuOpen = activeMenuMessageId === msg.messageId;
            const prevMsg = idx > 0 ? messages[idx - 1] : null;

            // Date separator check
            let showDateHeader = false;
            if (idx === 0) showDateHeader = true;
            else {
              const prevDate = parseSafeDate(messages[idx - 1].createdAt).toDateString();
              const currDate = parseSafeDate(msg.createdAt).toDateString();
              if (prevDate !== currDate) showDateHeader = true;
            }

            // Dynamic Margin for natural grouping
            const isSameSenderAsPrev = prevMsg && prevMsg.senderId === msg.senderId;
            const marginTopClass = showDateHeader ? 'mt-6' : (isSameSenderAsPrev ? 'mt-1' : 'mt-5');

            // Reactions count
            const reactionsMap = msg.reactions || {};
            const reactionCounts: Record<string, number> = {};
            Object.values(reactionsMap).forEach(emoji => {
              reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
            });

            return (
              <React.Fragment key={msg.messageId}>
                {showDateHeader && (
                  <div className="flex justify-center my-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-white border border-slate-200 text-slate-400 px-4 py-1.5 rounded-full shadow-sm">
                      {formatHeaderDate(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div
                  id={`msg-${msg.messageId}`}
                  className={clsx(
                    "flex flex-col w-full max-w-[85%] sm:max-w-[75%] md:max-w-[65%] group relative transition-all duration-200",
                    isMe ? "ml-auto items-end" : "mr-auto items-start",
                    marginTopClass
                  )}
                >
                  {/* Message Bubble Container */}
                  <div className={clsx(
                    "px-4 py-2.5 rounded-[1.25rem] text-[14.5px] break-words relative shadow-sm leading-relaxed transition-all",
                    isMe
                      ? (activeWallpaper.bubbleMeClass || "bg-brand-600 text-white") + " rounded-br-xs"
                      : (activeWallpaper.bubbleOtherClass || "bg-white dark:bg-[#151b23] text-slate-900 dark:text-slate-100 border border-slate-200/70 dark:border-slate-800") + " rounded-bl-xs"
                  )}>

                    {/* Quoted Parent Reply Box */}
                    {msg.replyToMessage && (
                      <div
                        onClick={() => scrollToMessageId(msg.replyToMessage!.messageId)}
                        className={clsx(
                          "mb-2 p-2 rounded-lg text-xs border-l-4 cursor-pointer transition-opacity hover:opacity-90 flex items-start gap-2",
                          isMe
                            ? "bg-brand-700/60 border-amber-300 text-white"
                            : "bg-slate-100 dark:bg-slate-800/80 border-brand-500 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        <CornerDownRight className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-75" />
                        <div className="min-w-0">
                          <p className="font-extrabold text-[11px] opacity-90">
                            {msg.replyToMessage.senderId === currentUserId ? 'You' : conversation.otherUser.name}
                          </p>
                          <p className="truncate text-[11px] font-medium opacity-80">
                            {msg.replyToMessage.content}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Attachment / Media Render */}
                    {(msg.attachmentFileId || msg.localMediaUrl) && !msg.isDeletedEveryone && (
                      <div className={clsx("min-w-[200px]", msg.content ? "mb-2" : "")}>
                        {msg.localMediaUrl || (msg.fileMimeType && (msg.fileMimeType.startsWith('image/') || msg.fileMimeType.startsWith('video/'))) ? (
                          <div className="relative group/media overflow-hidden rounded-xl border border-slate-200/50 bg-black/5 dark:bg-white/5">
                            {msg.fileMimeType?.startsWith('video/') ? (
                              <video src={msg.localMediaUrl || `${getApiUrl(`/messaging/attachments/${msg.attachmentFileId}`)}?token=${localStorage.getItem('token')}`} controls className="w-full max-h-64 object-contain rounded-xl" />
                            ) : (
                              <img src={msg.localMediaUrl || `${getApiUrl(`/messaging/attachments/${msg.attachmentFileId}`)}?token=${localStorage.getItem('token')}`} alt="Media" className="w-full max-h-64 object-cover rounded-xl" />
                            )}
                            
                            {/* Uploading Overlay */}
                            {msg.isUploading && (
                              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl transition-all">
                                <Loader2 className="w-8 h-8 text-white animate-spin mb-2 drop-shadow-md" />
                                <span className="text-white text-xs font-bold tracking-wide drop-shadow-md">Uploading...</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <a
                            href={msg.isUploading ? "#" : `${getApiUrl(`/messaging/attachments/${msg.attachmentFileId}`)}?token=${localStorage.getItem('token')}`}
                            target={msg.isUploading ? "_self" : "_blank"}
                            rel="noopener noreferrer"
                            className={clsx(
                              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border",
                              msg.isUploading ? "cursor-wait opacity-80" : "cursor-pointer",
                              isMe
                                ? "bg-white/15 hover:bg-white/25 border-white/20 text-white shadow-sm"
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800 shadow-sm"
                            )}
                          >
                            <div className={clsx("p-2 rounded-lg shrink-0", isMe ? "bg-white/20" : "bg-white shadow-sm border border-slate-200/60")}>
                              {msg.isUploading ? (
                                <Loader2 className={clsx("w-4 h-4 animate-spin", isMe ? "text-white" : "text-brand-500")} />
                              ) : (
                                <FileText className={clsx("w-4 h-4", isMe ? "text-white" : "text-indigo-500")} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="text-[13px] font-bold truncate leading-snug">
                                {msg.isUploading ? "Uploading File..." : "Attachment File"}
                              </div>
                            </div>
                            {!msg.isUploading && (
                              <div className={clsx("p-2 rounded-lg shrink-0 transition-colors border", isMe ? "border-white/20 hover:bg-white/20" : "border-slate-200 bg-white hover:bg-slate-50")}>
                                <Download className="w-4 h-4 opacity-80" />
                              </div>
                            )}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Message Body Content */}
                    <div className={clsx(msg.isDeletedEveryone && "italic opacity-70")}>
                      {msg.content}
                    </div>

                    {/* Action Trigger Dots */}
                    <button
                      onClick={() => setActiveMenuMessageId(isMenuOpen ? null : msg.messageId)}
                      className={clsx(
                        "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md cursor-pointer",
                        isMe
                          ? "right-full mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white/80 dark:bg-navy-900/80"
                          : "left-full ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white/80 dark:bg-navy-900/80"
                      )}
                      title="Message options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Context Menu Dropdown */}
                  {isMenuOpen && (
                    <div className={clsx(
                      "absolute top-8 z-30 w-48 bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100",
                      isMe ? "right-0" : "left-0"
                    )}>
                      {/* Emoji Quick Bar */}
                      <div className="flex items-center justify-around pb-1.5 mb-1 border-b border-slate-100 dark:border-slate-800">
                        {QUICK_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => {
                              onToggleReaction(msg.messageId, emoji);
                              setActiveMenuMessageId(null);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-md text-base transition-transform hover:scale-125 cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          setReplyingToMessage(msg);
                          setActiveMenuMessageId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg flex items-center gap-2 cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5 text-brand-500" />
                        <span>Reply</span>
                      </button>

                      {isMe && !msg.isDeletedEveryone && (
                        <button
                          onClick={() => handleStartEdit(msg)}
                          className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg flex items-center gap-2 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                          <span>Edit</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleCopyText(msg.content)}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg flex items-center gap-2 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Text</span>
                      </button>

                      <button
                        onClick={() => {
                          onForwardMessage(msg);
                          setActiveMenuMessageId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg flex items-center gap-2 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Forward</span>
                      </button>

                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                      <button
                        onClick={() => {
                          onDeleteMessage(msg.messageId, 'FOR_ME');
                          setActiveMenuMessageId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete for me</span>
                      </button>

                      {isMe && !msg.isDeletedEveryone && (
                        <button
                          onClick={() => {
                            onDeleteMessage(msg.messageId, 'FOR_EVERYONE');
                            setActiveMenuMessageId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete for everyone</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reaction Badges */}
                  {Object.keys(reactionCounts).length > 0 && (
                    <div className={clsx("flex flex-wrap gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <span
                          key={emoji}
                          onClick={() => onToggleReaction(msg.messageId, emoji)}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:scale-110 transition-transform font-bold text-slate-700 dark:text-slate-300"
                        >
                          <span>{emoji}</span>
                          {count > 1 && <span className="text-[10px] text-slate-500">{count}</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Timestamp & Delivery Ticks */}
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    <span className="text-[10.5px] font-bold text-slate-400">
                      {formatTime(msg.createdAt)}
                    </span>

                    {msg.isEdited && (
                      <span className="text-[10px] font-bold text-slate-400 italic">
                        • edited
                      </span>
                    )}

                    {isMe && (
                      <span className="flex items-center ml-0.5">
                        {msg.status === 'SENDING' ? (
                          <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                        ) : msg.status === 'SENT' ? (
                          <span title="Sent ✓"><Check className="w-3.5 h-3.5 text-slate-400" /></span>
                        ) : msg.status === 'DELIVERED' ? (
                          <span title="Delivered ✓✓"><CheckCheck className="w-3.5 h-3.5 text-slate-400" /></span>
                        ) : (
                          <span title="Read ✓✓"><CheckCheck className="w-3.5 h-3.5 text-brand-500 dark:text-cyan-400 font-extrabold" /></span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Floating Scroll Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShowScrollBottom(false);
            setNewMessagesCount(0);
          }}
          className="absolute bottom-20 right-6 z-30 p-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 font-bold text-xs"
        >
          <ChevronDown className="w-4 h-4" />
          {newMessagesCount > 0 && <span>{newMessagesCount} new</span>}
        </button>
      )}

      {/* Input Composer Zone */}
      <div className="p-3 md:p-4 lg:p-5 border-t border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0B1120] shrink-0 relative z-20 pb-4 md:pb-5">

        {/* Replying Preview Banner */}
        {replyingToMessage && (
          <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between text-xs animate-in fade-in shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                <Reply className="w-4 h-4 shrink-0" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-indigo-900">
                  Replying to {replyingToMessage.senderId === currentUserId ? 'yourself' : conversation.otherUser.name}
                </span>
                <p className="truncate text-slate-600 font-medium mt-0.5">
                  {replyingToMessage.content}
                </p>
              </div>
            </div>
            <button
              onClick={() => setReplyingToMessage(null)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-indigo-100 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Editing Mode Banner */}
        {editingMessage && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between text-xs animate-in fade-in shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                <Edit2 className="w-4 h-4 shrink-0" />
              </div>
              <span className="font-extrabold text-amber-900">
                Editing message...
              </span>
            </div>
            <button
              onClick={handleCancelEdit}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-amber-100 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Selected File Preview Banner */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              {localPreviewUrl ? (
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-white">
                  {selectedFile.type.startsWith('video/') ? (
                    <video src={localPreviewUrl} className="w-full h-full object-cover" />
                  ) : (
                    <img src={localPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  )}
                </div>
              ) : (
                <div className="p-1.5 bg-white shadow-sm rounded-lg border border-slate-200 shrink-0">
                  <Paperclip className="w-4 h-4 text-emerald-500" />
                </div>
              )}
              <span className="truncate font-bold text-slate-700">
                {selectedFile.name} <span className="text-slate-400 font-medium ml-1">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              </span>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Emoji Picker Popup (Lazy Loaded) */}
        {showEmojiPicker && (
          <div className="absolute bottom-full right-4 mb-4 z-50 shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
            <React.Suspense fallback={<div className="p-4 text-xs font-bold text-slate-400 bg-white animate-pulse">Loading Emojis...</div>}>
              <LazyEmojiPicker
                onEmojiClick={(data) => setInputText(prev => prev + data.emoji)}
              />
            </React.Suspense>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSendSubmit} className="flex items-end gap-2 sm:gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-300 transition-all">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shrink-0 cursor-pointer mb-0.5"
            title="Attach File"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setShowEmojiPicker(prev => !prev)}
            className="p-3 text-slate-400 hover:text-amber-500 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shrink-0 cursor-pointer hidden sm:block mb-0.5"
            title="Emoji Picker"
          >
            <Smile className="w-5 h-5" />
          </button>

          <input
            type="text"
            placeholder={editingMessage ? "Update message..." : "Type your message..."}
            value={inputText}
            onChange={handleInputChange}
            className="flex-1 px-2 py-3.5 bg-transparent text-[14.5px] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-medium min-w-0"
          />

          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedFile) || isSending}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-[14px] shadow-sm transition-all shrink-0 cursor-pointer active:scale-95 flex items-center justify-center min-w-[46px] min-h-[46px] mb-0.5"
            title="Send Message"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
