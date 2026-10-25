import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send, ArrowLeft, Loader2, Info, Paperclip, Check, CheckCheck,
  MoreVertical, Reply, Edit2, Trash2, Copy, Share2, X, FileText, Download,
  CornerDownRight, ChevronDown, MessageSquare, Palette, Package, FileArchive, Ban
} from 'lucide-react';
import { clsx } from 'clsx';
import { Conversation } from './ConversationList';
import { getApiUrl } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

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
  filename?: string;
  fileSize?: number;
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
  const { user: authUser } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Build a comprehensive, normalized set of ALL identifiers representing "ME" (logged-in user)
  const myIdentifiers = useMemo(() => {
    const ids = new Set<string>();
    const add = (val?: string | number | null) => {
      if (!val) return;
      const str = String(val).trim().toLowerCase();
      if (!str) return;
      ids.add(str);
      if (str.startsWith('staff_')) {
        ids.add(str.substring(6).trim());
      } else if (/^\d+$/.test(str)) {
        ids.add(`staff_${str}`);
      }
    };

    add(currentUserId);
    if (authUser) {
      add(authUser.id);
      add(authUser.username);
      add(authUser.email);
      add((authUser as any).reg_no);
      add((authUser as any).regNo);
      add(authUser.uid);
    }
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        add(u.id);
        add(u.username);
        add(u.email);
        add(u.reg_no);
        add(u.regNo);
        add(u.uid);
      }
    } catch {}

    return ids;
  }, [currentUserId, authUser]);

  // Build a normalized set of ALL identifiers representing the other participant
  const otherIdentifiers = useMemo(() => {
    const ids = new Set<string>();
    const add = (val?: string | number | null) => {
      if (!val) return;
      const str = String(val).trim().toLowerCase();
      if (!str) return;
      ids.add(str);
      if (str.startsWith('staff_')) {
        ids.add(str.substring(6).trim());
      } else if (/^\d+$/.test(str)) {
        ids.add(`staff_${str}`);
      }
    };

    const other = conversation?.otherUser;
    if (other) {
      add(other.id);
      add((other as any).regNo);
      add((other as any).reg_no);
      add((other as any).email);
      add((other as any).username);
    }
    return ids;
  }, [conversation?.otherUser]);

  // Determine if this is a self-conversation (e.g. testing with own account or note-to-self)
  const isSelfConversation = useMemo(() => {
    if (!conversation?.otherUser) return false;
    for (const id of otherIdentifiers) {
      if (myIdentifiers.has(id)) return true;
    }
    return false;
  }, [otherIdentifiers, myIdentifiers]);

  // Authoritative, multi-factor determination of outgoing (isMe) vs incoming message
  const checkIsMe = useCallback((msgObj: Message | null): boolean => {
    if (!msgObj) return false;

    // 1. Optimistic / local in-flight message is ALWAYS outgoing
    if (msgObj.status === 'SENDING' || msgObj.messageId.startsWith('TEMP_')) {
      return true;
    }

    const msgSender = String(msgObj.senderId || '').trim().toLowerCase();
    const msgReceiver = String(msgObj.receiverId || '').trim().toLowerCase();

    // 2. Direct check: Is sender matching ANY of current user's IDs?
    const isSenderMe = myIdentifiers.has(msgSender) ||
      (msgSender.startsWith('staff_') && myIdentifiers.has(msgSender.substring(6)));

    // 3. Direct check: Is sender matching ANY of other user's IDs?
    const isSenderOther = otherIdentifiers.has(msgSender) ||
      (msgSender.startsWith('staff_') && otherIdentifiers.has(msgSender.substring(6)));

    // 4. In a self-conversation (talking to myself / notes to self / self-test):
    // All messages originated from this user's account and should be rendered as outgoing (right-aligned)
    if (isSelfConversation) {
      return true;
    }

    // 5. Standard 1-on-1 conversations:
    if (isSenderMe && !isSenderOther) {
      return true;
    }
    if (isSenderOther && !isSenderMe) {
      return false;
    }

    // 6. Check receiver target: Was it sent TO the other participant?
    const isReceiverOther = otherIdentifiers.has(msgReceiver) ||
      (msgReceiver.startsWith('staff_') && otherIdentifiers.has(msgReceiver.substring(6)));
    const isReceiverMe = myIdentifiers.has(msgReceiver) ||
      (msgReceiver.startsWith('staff_') && myIdentifiers.has(msgReceiver.substring(6)));

    if (isReceiverOther && !isReceiverMe) {
      return true;
    }
    if (isReceiverMe && !isReceiverOther) {
      return false;
    }

    // 7. Fallback: If sender matches current user
    if (isSenderMe) {
      return true;
    }

    return false;
  }, [myIdentifiers, otherIdentifiers, isSelfConversation]);

  useEffect(() => {
    textInputRef.current?.focus();
  }, [conversation?.conversationId]);
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
  const touchTimerRef = useRef<any>(null);

  // Auto scroll behavior
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    
    if (isNearBottom || messages[messages.length - 1]?.senderId === currentUserId) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
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
    setShowScrollBottom(prev => (prev !== !isNearBottom ? !isNearBottom : prev));
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
      setTimeout(() => textInputRef.current?.focus(), 30);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadFileAttachment = async (fileId?: string, fallbackFilename?: string) => {
    if (!fileId) return;
    try {
      const token = localStorage.getItem('token');
      const url = `${getApiUrl(`/messaging/attachments/${fileId}`)}?token=${token}`;
      
      notify.info('Downloading File', 'Preparing file download...', { category: 'MESSAGING' });

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (!res.ok) {
        throw new Error(`Download HTTP error ${res.status}`);
      }

      let filename = fallbackFilename || 'attachment';
      const disposition = res.headers.get('Content-Disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 10000);
      notify.success('Download Complete', `${filename} saved successfully.`, { category: 'MESSAGING' });
    } catch (err) {
      console.error('Blob download failed, fallback to direct link:', err);
      const token = localStorage.getItem('token');
      const directUrl = `${getApiUrl(`/messaging/attachments/${fileId}`)}?token=${token}`;
      window.location.href = directUrl;
    }
  };

  const renderFileAttachmentCard = (msg: Message, isMe: boolean) => {
    const fname = msg.filename || (msg.attachmentFileId ? `File_${msg.attachmentFileId.substring(4, 10)}` : 'Attachment');
    const ext = fname.split('.').pop()?.toLowerCase() || '';
    const isApk = ext === 'apk' || msg.fileMimeType?.includes('vnd.android.package-archive');
    const isPdf = ext === 'pdf' || msg.fileMimeType?.includes('pdf');
    const isZip = ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);

    let IconComp = FileText;
    let iconBg = isMe ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400";
    let typeLabel = ext ? ext.toUpperCase() : 'FILE';

    if (isApk) {
      IconComp = Package;
      iconBg = isMe ? "bg-emerald-400/30 text-emerald-100" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300";
      typeLabel = 'APK Package';
    } else if (isPdf) {
      iconBg = isMe ? "bg-rose-400/30 text-rose-100" : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300";
      typeLabel = 'PDF Document';
    } else if (isZip) {
      IconComp = FileArchive;
      iconBg = isMe ? "bg-amber-400/30 text-amber-100" : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
      typeLabel = 'Archive Zip';
    }

    const sizeFormatted = formatFileSize(msg.fileSize);

    return (
      <div
        onClick={() => !msg.isUploading && handleDownloadFileAttachment(msg.attachmentFileId, fname)}
        className={clsx(
          "flex items-center gap-3 p-2.5 rounded-xl transition-all border group/file select-none",
          msg.isUploading ? "cursor-wait opacity-80" : "cursor-pointer hover:shadow-md active:scale-[0.99]",
          isMe
            ? "bg-black/10 hover:bg-black/20 border-white/20 text-white shadow-sm"
            : "bg-slate-50 dark:bg-[#1f2c34] hover:bg-slate-100 dark:hover:bg-[#253239] border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
        )}
      >
        <div className={clsx("p-2.5 rounded-xl shrink-0 transition-transform group-hover/file:scale-105", iconBg)}>
          {msg.isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <IconComp className="w-5 h-5 drop-shadow-sm" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="text-[13px] font-bold truncate leading-snug tracking-tight">
            {msg.isUploading ? "Uploading file..." : fname}
          </div>
          <div className={clsx("text-[11px] font-medium flex items-center gap-1.5 mt-0.5 opacity-80", isMe ? "text-white/80" : "text-slate-500 dark:text-slate-400")}>
            <span className="uppercase font-bold tracking-wider px-1.5 py-0.5 rounded text-[9px] bg-black/10 dark:bg-white/10">
              {typeLabel}
            </span>
            {sizeFormatted && <span>• {sizeFormatted}</span>}
          </div>
        </div>

        {!msg.isUploading && (
          <div
            className={clsx(
              "p-2 rounded-full shrink-0 transition-all border shadow-sm group-hover/file:scale-110",
              isMe
                ? "bg-white/20 hover:bg-white/30 border-white/30 text-white"
                : "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400"
            )}
            title="Download File"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
          </div>
        )}
      </div>
    );
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
      <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl z-20 shrink-0 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 -ml-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl md:hidden transition-colors cursor-pointer active:scale-95 shrink-0"
            title="Back to inbox"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div className="relative cursor-pointer group shrink-0" onClick={onToggleInfo}>
            <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-2xl sm:rounded-full bg-gradient-to-br from-brand-600 via-indigo-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 active:scale-95">
              <span className="text-white font-black text-sm sm:text-base md:text-xl">
                {conversation.otherUser.name.charAt(0).toUpperCase()}
              </span>
            </div>
            {conversation.otherUser.isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-500 border-2 border-white dark:border-navy-950 rounded-full" title="Online now" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 tracking-tight text-xs sm:text-sm md:text-base leading-snug">
              <span className="truncate">{conversation.otherUser.name}</span>
              <span className={clsx(
                "text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0",
                conversation.otherUser.type === 'STAFF'
                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30"
                  : "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/30"
              )}>
                {conversation.otherUser.role}
              </span>
            </h3>

            {isOtherUserTyping ? (
              <p className="text-[11px] sm:text-xs text-emerald-500 font-extrabold italic animate-pulse flex items-center gap-1">
                <span>typing...</span>
              </p>
            ) : (
              <p className="text-[10.5px] sm:text-xs text-slate-400 font-medium flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="truncate">{conversation.otherUser.department}</span>
                <span className="shrink-0">•</span>
                <span className="flex items-center gap-1 shrink-0">
                  {conversation.otherUser.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
                  {conversation.otherUser.isOnline ? 'Online' : 'Offline'}
                </span>
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
        className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-3 sm:py-4 flex flex-col custom-scrollbar relative z-10 max-w-5xl mx-auto w-full"
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-400 py-16 flex flex-col items-center">
            <div className="w-14 h-14 bg-brand-50 dark:bg-brand-950/40 rounded-2xl flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7 text-brand-500" />
            </div>
            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">Start an encrypted institutional dialogue!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            // Skip empty phantom messages that have no content, no attachment, and no deleted status
            if (!msg.content && !msg.attachmentFileId && !msg.localMediaUrl && !msg.isDeletedEveryone) {
              return null;
            }

            // Authoritative determination of outgoing (isMe) vs incoming message
            const isMe = checkIsMe(msg);
            const msgSender = String(msg.senderId || '').trim().toLowerCase();
            const canEditOrDeleteEveryone = (isMe || myIdentifiers.has(msgSender)) && !msg.isDeletedEveryone;
            const isMenuOpen = activeMenuMessageId === msg.messageId;
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const prevIsMe = prevMsg ? checkIsMe(prevMsg) : false;

            // Date separator check
            let showDateHeader = false;
            if (idx === 0) showDateHeader = true;
            else if (prevMsg) {
              const prevDate = parseSafeDate(prevMsg.createdAt).toDateString();
              const currDate = parseSafeDate(msg.createdAt).toDateString();
              if (prevDate !== currDate) showDateHeader = true;
            }

            // Dynamic Margin for natural grouping
            const isSameSenderAsPrev = prevMsg && (prevIsMe === isMe) && !showDateHeader;
            const marginTopClass = showDateHeader ? 'mt-3 sm:mt-4' : (isSameSenderAsPrev ? 'mt-1' : 'mt-2.5 sm:mt-3');

            // Reactions count
            const reactionsMap = msg.reactions || {};
            const reactionCounts: Record<string, number> = {};
            Object.values(reactionsMap).forEach(emoji => {
              reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
            });

            // Reply sender determination
            const replySender = String(msg.replyToMessage?.senderId || '').trim().toLowerCase();
            const isReplyFromOther = otherIdentifiers.has(replySender) || (replySender.startsWith('staff_') && otherIdentifiers.has(replySender.substring(6)));

            return (
              <React.Fragment key={msg.messageId}>
                {showDateHeader && (
                  <div className="flex justify-center my-3 sm:my-4 select-none">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-slate-200/90 dark:bg-slate-800/90 border border-slate-300/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 px-3.5 py-1 rounded-full shadow-xs">
                      {formatHeaderDate(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div
                  id={`msg-${msg.messageId}`}
                  className={clsx(
                    "flex flex-col w-fit max-w-[85%] sm:max-w-[75%] md:max-w-[65%] group relative",
                    isMe ? "ml-auto items-end" : "mr-auto items-start",
                    marginTopClass
                  )}
                >
                  {/* Message Bubble Container */}
                  <div
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('a') || target.closest('video') || target.closest('audio') || target.closest('button')) return;
                      setActiveMenuMessageId(isMenuOpen ? null : msg.messageId);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveMenuMessageId(isMenuOpen ? null : msg.messageId);
                    }}
                    onTouchStart={() => {
                      touchTimerRef.current = setTimeout(() => {
                        setActiveMenuMessageId(msg.messageId);
                      }, 350);
                    }}
                    onTouchEnd={() => {
                      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
                    }}
                    onTouchMove={() => {
                      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
                    }}
                    className={clsx(
                      "px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl text-[14px] sm:text-[14.5px] break-words relative shadow-xs leading-relaxed cursor-pointer select-text transition-all",
                      msg.isDeletedEveryone
                        ? clsx(
                            "border italic select-none shadow-none",
                            isMe
                              ? "bg-slate-100/95 dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 rounded-br-xs"
                              : "bg-slate-50/95 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-bl-xs"
                          )
                        : isMe
                          ? (activeWallpaper.bubbleMeClass || "bg-brand-600 text-white") + " rounded-br-xs"
                          : (activeWallpaper.bubbleOtherClass || "bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800") + " rounded-bl-xs"
                    )}
                  >

                    {/* Quoted Parent Reply Box */}
                    {msg.replyToMessage && !msg.isDeletedEveryone && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          scrollToMessageId(msg.replyToMessage!.messageId);
                        }}
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
                            {isReplyFromOther ? (conversation?.otherUser?.name || 'Other') : 'You'}
                          </p>
                          <p className="truncate text-[11px] font-medium opacity-80">
                            {msg.replyToMessage.content}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Attachment / Media Render */}
                    {(msg.attachmentFileId || msg.localMediaUrl) && !msg.isDeletedEveryone && (
                      <div className={clsx("min-w-[200px]", msg.content ? "mb-1.5" : "")}>
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
                          renderFileAttachmentCard(msg, isMe)
                        )}
                      </div>
                    )}

                    {/* Message Body Content + Inline WhatsApp-style Timestamp */}
                    {msg.isDeletedEveryone ? (
                      <div className="italic text-xs sm:text-[13px] flex items-center gap-1.5 min-w-0 text-slate-500 dark:text-slate-400 select-none py-0.5">
                        <Ban className="w-3.5 h-3.5 opacity-70 shrink-0" />
                        <span className="whitespace-nowrap font-medium">
                          {isMe ? "You deleted this message" : "This message was deleted"}
                        </span>
                      </div>
                    ) : (
                      <div className="relative text-[13.5px] sm:text-[14px] leading-relaxed break-words [word-break:break-word] [overflow-wrap:anywhere]">
                        {msg.content && (
                          <span className="inline whitespace-pre-wrap">{msg.content}</span>
                        )}
                        {/* Inline Floating Timestamp & Delivery Ticks */}
                        <span className={clsx(
                          "inline-flex items-center gap-1 float-right translate-y-1 ml-2.5 pl-1 select-none text-[10px] font-medium leading-none whitespace-nowrap",
                          isMe ? "text-white/75" : "text-slate-400 dark:text-slate-400"
                        )}>
                          <span>{formatTime(msg.createdAt)}</span>
                          {msg.isEdited && <span className="italic text-[9px]">• edited</span>}
                          {isMe && !msg.isDeletedEveryone && (
                            <span className="inline-flex items-center ml-0.5 shrink-0">
                              {msg.status === 'SENDING' ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin text-white/70" />
                              ) : msg.status === 'SENT' ? (
                                <Check className="w-3.5 h-3.5 text-white/70" />
                              ) : msg.status === 'DELIVERED' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                              ) : (
                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] stroke-[2.5]" />
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* If Attachment only without text content, show timestamp nestled inside */}
                    {!msg.content && (msg.attachmentFileId || msg.localMediaUrl) && !msg.isDeletedEveryone && (
                      <div className={clsx(
                        "flex items-center justify-end gap-1 mt-1 select-none text-[10px] font-medium leading-none",
                        isMe ? "text-white/75" : "text-slate-400 dark:text-slate-400"
                      )}>
                        <span>{formatTime(msg.createdAt)}</span>
                        {isMe && (
                          <span className="inline-flex items-center ml-0.5 shrink-0">
                            {msg.status === 'SENDING' ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-white/70" />
                            ) : msg.status === 'SENT' ? (
                              <Check className="w-3.5 h-3.5 text-white/70" />
                            ) : msg.status === 'DELIVERED' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                            ) : (
                              <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] stroke-[2.5]" />
                            )}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Desktop Hover Options Trigger */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuMessageId(isMenuOpen ? null : msg.messageId);
                      }}
                      className={clsx(
                        "hidden sm:flex opacity-0 group-hover:opacity-100 absolute -top-2.5 p-1 rounded-full shadow-md cursor-pointer transition-all z-20 items-center justify-center",
                        isMe
                          ? "-left-2 bg-slate-800 text-white hover:bg-slate-700"
                          : "-right-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                      )}
                      title="Message Options"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Transparent Backdrop to close on click outside */}
                  {isMenuOpen && (
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuMessageId(null);
                      }} 
                    />
                  )}

                  {/* Context Menu Dropdown */}
                  {isMenuOpen && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className={clsx(
                        "absolute top-8 z-40 w-56 max-w-[calc(100vw-2.5rem)] bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100",
                        isMe ? "right-0" : "left-0"
                      )}
                    >
                      {/* Quick Reactions Bar */}
                      {!msg.isDeletedEveryone && (
                        <div className="flex items-center justify-between px-2 py-1 mb-1 bg-slate-50 dark:bg-navy-950/60 rounded-xl border border-slate-100 dark:border-slate-800/80">
                          {['👍', '❤️', '😂', '😮', '🎉', '🔥'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                onToggleReaction(msg.messageId, emoji);
                                setActiveMenuMessageId(null);
                              }}
                              className="hover:scale-125 transition-transform p-1 text-base cursor-pointer"
                              title={`React ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Reply */}
                      {!msg.isDeletedEveryone && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingToMessage(msg);
                            setEditingMessage(null);
                            setActiveMenuMessageId(null);
                            setTimeout(() => textInputRef.current?.focus(), 50);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <Reply className="w-4 h-4 text-brand-500" />
                          <span>Reply</span>
                        </button>
                      )}

                      {/* Edit (For my messages) */}
                      {canEditOrDeleteEveryone && (
                        <button
                          type="button"
                          onClick={() => {
                            handleStartEdit(msg);
                            setActiveMenuMessageId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <Edit2 className="w-4 h-4 text-amber-500" />
                            <span>Edit Message</span>
                          </div>
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 rounded-md">
                            Sender
                          </span>
                        </button>
                      )}

                      {/* Copy Text */}
                      {msg.content && !msg.isDeletedEveryone && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCopyText(msg.content);
                            setActiveMenuMessageId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <Copy className="w-4 h-4 text-slate-500" />
                          <span>Copy Text</span>
                        </button>
                      )}

                      {/* Forward */}
                      {!msg.isDeletedEveryone && (
                        <button
                          type="button"
                          onClick={() => {
                            onForwardMessage(msg);
                            setActiveMenuMessageId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <Share2 className="w-4 h-4 text-indigo-500" />
                          <span>Forward</span>
                        </button>
                      )}

                      {!msg.isDeletedEveryone && (
                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                      )}

                      {/* Delete for me */}
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteMessage(msg.messageId, 'FOR_ME');
                          setActiveMenuMessageId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete for me</span>
                      </button>

                      {/* Delete for everyone */}
                      {canEditOrDeleteEveryone && (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteMessage(msg.messageId, 'FOR_EVERYONE');
                            setActiveMenuMessageId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-black text-rose-600 hover:bg-rose-100/70 dark:hover:bg-rose-950/70 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <Trash2 className="w-4 h-4 text-rose-600" />
                            <span>Delete for everyone</span>
                          </div>
                          <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 rounded-md">
                            Unsend
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reaction Badges */}
                  {Object.keys(reactionCounts).length > 0 && !msg.isDeletedEveryone && (
                    <div className={clsx("flex flex-wrap gap-1 -mt-1.5 z-10 mb-0.5", isMe ? "justify-end mr-1" : "justify-start ml-1")}>
                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <span
                          key={emoji}
                          onClick={() => onToggleReaction(msg.messageId, emoji)}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer hover:scale-110 active:scale-95 transition-transform font-bold text-slate-700 dark:text-slate-300"
                        >
                          <span>{emoji}</span>
                          {count > 1 && <span className="text-[9px] text-slate-500 dark:text-slate-400">{count}</span>}
                        </span>
                      ))}
                    </div>
                  )}
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
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
              });
            }
            setShowScrollBottom(false);
            setNewMessagesCount(0);
          }}
          className="absolute bottom-20 right-6 z-30 p-2.5 bg-[#00a884] hover:bg-[#008f70] text-white rounded-full shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 font-bold text-xs"
        >
          <ChevronDown className="w-4 h-4" />
          {newMessagesCount > 0 && <span>{newMessagesCount} new</span>}
        </button>
      )}

      {/* WhatsApp Style Input Composer Zone */}
      <div className="p-2 sm:p-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] border-t border-slate-200/80 dark:border-slate-800/80 bg-[#f0f2f5] dark:bg-[#111b21] backdrop-blur-md shrink-0 relative z-20">

        {/* Replying Preview Banner */}
        {replyingToMessage && (
          <div className="mb-2.5 p-2.5 bg-white dark:bg-[#202c33] border-l-4 border-[#00a884] rounded-xl flex items-center justify-between text-xs animate-in fade-in shadow-sm max-w-5xl mx-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-[#00a884]/10 dark:bg-[#00a884]/20 text-[#00a884] rounded-lg shrink-0">
                <Reply className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-[#00a884]">
                  Replying to {replyingToMessage.senderId === currentUserId ? 'yourself' : conversation.otherUser.name}
                </span>
                <p className="truncate text-slate-600 dark:text-slate-300 font-medium text-[11px] mt-0.5">
                  {replyingToMessage.content}
                </p>
              </div>
            </div>
            <button
              onClick={() => setReplyingToMessage(null)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Editing Mode Banner */}
        {editingMessage && (
          <div className="mb-2.5 p-2.5 bg-white dark:bg-[#202c33] border-l-4 border-amber-500 rounded-xl flex items-center justify-between text-xs animate-in fade-in shadow-sm max-w-5xl mx-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 rounded-lg shrink-0">
                <Edit2 className="w-3.5 h-3.5" />
              </div>
              <span className="font-extrabold text-amber-600 dark:text-amber-400">
                Editing message...
              </span>
            </div>
            <button
              onClick={handleCancelEdit}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Selected File Preview Banner */}
        {selectedFile && (
          <div className="mb-2.5 p-2.5 bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between text-xs shadow-sm max-w-5xl mx-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              {localPreviewUrl ? (
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-black/5">
                  {selectedFile.type.startsWith('video/') ? (
                    <video src={localPreviewUrl} className="w-full h-full object-cover" />
                  ) : (
                    <img src={localPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  )}
                </div>
              ) : (
                <div className="p-2 bg-[#00a884]/10 dark:bg-[#00a884]/20 rounded-xl border border-[#00a884]/30 shrink-0">
                  <Paperclip className="w-4 h-4 text-[#00a884]" />
                </div>
              )}
              <div className="min-w-0">
                <span className="truncate font-black text-slate-800 dark:text-slate-100 block">
                  {selectedFile.name}
                </span>
                <span className="text-slate-400 text-[11px] font-semibold">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


        {/* WhatsApp Style Form: Unified Input Pill with Send Button Inside */}
        <form onSubmit={handleSendSubmit} className="flex items-center gap-1.5 sm:gap-2 max-w-5xl mx-auto w-full flex-nowrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
            className="hidden"
          />

          {/* Unified Input Pill with emoji + attach + text + send all inside */}
          <div className="flex-1 flex items-center gap-1 sm:gap-2 bg-white dark:bg-[#202c33] border border-slate-200/90 dark:border-slate-700/80 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 shadow-xs focus-within:shadow-md focus-within:ring-2 focus-within:ring-[#00a884]/30 focus-within:border-[#00a884] transition-all min-w-0">

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-slate-500 hover:text-[#00a884] dark:text-slate-400 dark:hover:text-[#00a884] rounded-full transition-all shrink-0 cursor-pointer active:scale-95"
              title="Attach File"
              aria-label="Attach File"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 transform -rotate-45" />
            </button>

            <input
              ref={textInputRef}
              type="text"
              placeholder={editingMessage ? "Update message..." : "Type a message..."}
              value={inputText}
              onChange={handleInputChange}
              className="flex-1 px-1.5 sm:px-2 bg-transparent text-xs sm:text-sm md:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-medium min-w-0"
            />

            {/* Send Button — inside the pill on the right */}
            <button
              type="submit"
              disabled={(!inputText.trim() && !selectedFile) || isSending}
              className={clsx(
                "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200 active:scale-90",
                (inputText.trim() || selectedFile) && !isSending
                  ? "bg-[#00a884] hover:bg-[#008f70] text-white shadow-md shadow-[#00a884]/30 scale-100 hover:scale-105"
                  : "bg-[#00a884]/60 text-white cursor-default"
              )}
              title="Send Message"
              aria-label="Send Message"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-white" />
              ) : (
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white transform translate-x-0.5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
