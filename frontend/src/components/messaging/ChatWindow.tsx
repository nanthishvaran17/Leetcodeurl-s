import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Loader2, Info, Paperclip, Smile } from 'lucide-react';
import { clsx } from 'clsx';
import { Conversation } from './ConversationList';
import { useNotification } from '../../context/NotificationContext';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import axios from 'axios';
import { getApiUrl, getAuthHeaders } from '../../services/api';

export interface Message {
  messageId: string;
  senderId: string;
  content: string;
  createdAt: string;
  status: 'SENT' | 'READ';
  attachmentFileId?: string;
}

interface Props {
  conversation: Conversation | null;
  messages: Message[];
  currentUserId: string;
  onSend: (content: string, attachmentFileId?: string) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  onToggleInfo?: () => void;
}

export const ChatWindow: React.FC<Props> = ({
  conversation, messages, currentUserId, onSend, onBack, isLoading, onToggleInfo
}) => {
  const { notify } = useNotification();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-navy-950/50 h-full">
        <div className="w-20 h-20 bg-brand-50 dark:bg-brand-900/20 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-brand-100 dark:border-brand-800/30">
          <Send className="w-8 h-8 text-brand-500 ml-1" />
        </div>
        <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Institutional Connect</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm max-w-xs text-center leading-relaxed font-medium">
          Select a conversation from your secure inbox or start a new message to connect with the institution.
        </p>
      </div>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;
    if (isSending) return;
    
    setIsSending(true);
    try {
      let attachmentFileId = undefined;
      
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        try {
          const res = await axios.post(getApiUrl('/messaging/upload'), formData, {
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'multipart/form-data'
            }
          });
          if (res.data?.success) {
            attachmentFileId = res.data.file_id;
          }
        } catch (err: any) {
          notify.error('Upload Failed', 'Failed to upload the attachment.');
          setIsSending(false);
          return;
        }
      }

      await onSend(inputText.trim(), attachmentFileId);
      setInputText('');
      setSelectedFile(null);
      setShowEmojiPicker(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setInputText(prev => prev + emojiData.emoji);
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

  return (
    <div className="flex-1 w-full flex flex-col h-full bg-white dark:bg-navy-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl md:hidden transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="relative cursor-pointer group" onClick={onToggleInfo}>
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-brand-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105">
              <span className="text-white font-black text-lg md:text-xl">
                {conversation.otherUser.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-navy-950 rounded-full"></div>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {conversation.otherUser.name}
              <span className={clsx(
                "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                conversation.otherUser.type === 'STAFF' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30" : "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/30"
              )}>
                {conversation.otherUser.role}
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {conversation.otherUser.department}
            </p>
          </div>
        </div>

        {onToggleInfo && (
          <button
            onClick={onToggleInfo}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <Info className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-400 py-12">
            No messages yet. Send a greeting to start the institutional dialogue!
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUserId;
            
            // Format dates for dividers
            let showDate = false;
            if (idx === 0) showDate = true;
            else {
              const prevDate = parseSafeDate(messages[idx-1].createdAt).toDateString();
              const currDate = parseSafeDate(msg.createdAt).toDateString();
              if (prevDate !== currDate) showDate = true;
            }

            return (
              <React.Fragment key={msg.messageId}>
                {showDate && (
                  <div className="flex justify-center my-6">
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-slate-200/50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-md">
                      {parseSafeDate(msg.createdAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
                
                <div className={clsx("flex flex-col max-w-[85%] md:max-w-[75%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                  <div className={clsx(
                    "px-4 py-2.5 rounded-[1.25rem] text-[15px] break-words relative group leading-relaxed",
                    isMe 
                      ? "bg-brand-600 text-white rounded-br-sm shadow-sm" 
                      : "bg-white dark:bg-[#151b23] text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-100 dark:border-slate-800 shadow-sm"
                  )}>
                    {msg.attachmentFileId && (
                      <div className="mb-2">
                        <a href={`${getApiUrl(`/messaging/attachments/${msg.attachmentFileId}`)}?token=${localStorage.getItem('token')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-white/20 dark:bg-slate-800/50 rounded-xl hover:bg-white/30 transition-colors">
                          <Paperclip className="w-4 h-4" />
                          <span className="text-sm font-semibold underline underline-offset-2">View Attachment</span>
                        </a>
                      </div>
                    )}
                    {msg.content}
                    
                    {/* Hover Actions (Stubbed) */}
                    <div className={clsx(
                      "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-lg p-1",
                      isMe ? "-left-12" : "-right-12"
                    )}>
                      <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Reply">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {formatTime(msg.createdAt)}
                    </span>
                    {isMe && (
                      <span className="text-[11px] text-brand-500 font-bold ml-1">
                        {msg.status === 'READ' ? 'Read' : 'Sent'}
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

      {/* Input */}
      <div className="p-3 md:p-4 border-t border-slate-100 dark:border-slate-800/60 bg-white dark:bg-navy-950 shrink-0 relative">
        {showEmojiPicker && (
          <div className="absolute bottom-full right-4 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.AUTO} />
          </div>
        )}
        
        {selectedFile && (
          <div className="absolute bottom-full left-4 mb-2 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl p-2 flex items-center gap-2 max-w-sm">
            <Paperclip className="w-4 h-4 text-brand-500 shrink-0" />
            <span className="text-xs font-medium truncate flex-1 text-slate-700 dark:text-slate-200">{selectedFile.name}</span>
            <button type="button" onClick={() => setSelectedFile(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-rose-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-end gap-2">
          <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden focus-within:bg-white dark:focus-within:bg-navy-950 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all flex items-end">
            
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className={clsx("p-3 transition-colors mb-0.5 ml-1", selectedFile ? "text-brand-500" : "text-slate-400 hover:text-brand-500")}
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Type your message..."
              className="flex-1 max-h-32 min-h-[44px] py-3 bg-transparent border-none text-[15px] text-slate-900 dark:text-slate-100 placeholder-gray-400 resize-none focus:outline-none focus:ring-0 leading-relaxed"
              rows={1}
            />

            <button 
              type="button" 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={clsx("p-3 transition-colors mb-0.5 mr-1", showEmojiPicker ? "text-brand-500" : "text-slate-400 hover:text-brand-500")}
              title="Add emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="w-[48px] h-[48px] bg-brand-600 disabled:bg-slate-100 disabled:dark:bg-slate-800 disabled:text-slate-400 text-white rounded-2xl hover:bg-brand-700 disabled:hover:bg-slate-100 disabled:dark:hover:bg-slate-800 transition-all shrink-0 flex items-center justify-center shadow-sm disabled:shadow-none hover:shadow-brand-500/25 mb-0.5"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
};
