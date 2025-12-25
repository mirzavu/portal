'use client';

import { useState, useEffect, useRef } from 'react';
import { Paperclip, Send, Trash2, Plus, Download, File, MessageSquare, X, Link, Check } from 'lucide-react';
import { formatDate, formatRelativeTime } from '@/lib/utils';

interface Thread {
  id: string;
  name: string;
  created: string;
  updated: string;
}

interface FileInfo {
  name: string;
  size: number;
  type: string;
}

interface Message {
  id: string;
  thread_id: string;
  message?: string;
  file?: string | string[];
  file_name?: string | string[];
  file_size?: number | number[];
  file_type?: string | string[];
  timestamp: string;
  created: string;
  updated: string;
}

export default function FileTransferPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [newThreadName, setNewThreadName] = useState('');
  const [creatingThread, setCreatingThread] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchThreads = async (savedThreadId?: string | null) => {
    try {
      setLoading(true);
      const response = await fetch('/api/file-transfer/threads');
      if (!response.ok) throw new Error('Failed to fetch threads');
      const data = await response.json();
      setThreads(data.items || []);
      setError(null);

      // Use savedThreadId parameter or current selectedThreadId state
      const threadIdToCheck = savedThreadId !== undefined ? savedThreadId : selectedThreadId;

      if (threadIdToCheck && data.items) {
        // Validate that the saved/selected thread still exists
        const threadExists = data.items.some((t: Thread) => t.id === threadIdToCheck);
        if (threadExists) {
          setSelectedThreadId(threadIdToCheck);
        } else if (data.items.length > 0) {
          // Selected thread no longer exists, select first thread
          setSelectedThreadId(data.items[0].id);
        }
      } else if (!threadIdToCheck && data.items && data.items.length > 0) {
        // No saved thread, auto-select first thread
        setSelectedThreadId(data.items[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (threadId: string) => {
    if (!threadId) return;

    try {
      setLoadingMessages(true);
      setError(null); // Clear previous errors
      const response = await fetch(`/api/file-transfer/threads/${threadId}/messages`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to fetch messages');
      }
      const data = await response.json();
      setMessages(data.items || []);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      // Only set error if it's not a "not found" case (empty messages list is fine)
      if (err.message && !err.message.includes('not found')) {
        setError(err.message);
      } else {
        setMessages([]); // Set empty messages if thread not found or has no messages
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  // Load saved thread ID from localStorage on mount and fetch threads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedThreadId = localStorage.getItem('fileTransfer_selectedThreadId');
      // Pass savedThreadId directly to fetchThreads to avoid race condition
      fetchThreads(savedThreadId);
    } else {
      fetchThreads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save selected thread ID to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedThreadId) {
      localStorage.setItem('fileTransfer_selectedThreadId', selectedThreadId);
    }
  }, [selectedThreadId]);

  useEffect(() => {
    if (selectedThreadId) {
      // Only fetch messages if thread ID is valid and threads have been loaded
      if (threads.length > 0 || !loading) {
        fetchMessages(selectedThreadId);
      }
    } else {
      // Clear messages if no thread is selected
      setMessages([]);
    }
  }, [selectedThreadId, loading]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateThread = async () => {
    if (!newThreadName.trim()) return;

    try {
      setCreatingThread(true);
      const response = await fetch('/api/file-transfer/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newThreadName.trim() }),
      });

      if (!response.ok) throw new Error('Failed to create thread');
      const thread = await response.json();

      setShowCreateThread(false);
      setNewThreadName('');
      await fetchThreads();
      setSelectedThreadId(thread.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingThread(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedThreadId) return;
    if (!messageText.trim() && selectedFiles.length === 0) return;

    try {
      setUploading(true);
      const formData = new FormData();
      if (messageText.trim()) {
        formData.append('message', messageText);
      }
      // Append all selected files
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`/api/file-transfer/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to send message');
      }

      setMessageText('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await fetchMessages(selectedThreadId);
      await fetchThreads(); // Refresh threads to update updated timestamp
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const response = await fetch(`/api/file-transfer/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete message');

      if (selectedThreadId) {
        await fetchMessages(selectedThreadId);
        await fetchThreads();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmptyThread = async (threadId: string, threadName: string) => {
    if (!confirm(`Are you sure you want to empty the thread "${threadName}"? This will delete all messages and files in this thread, but the thread will remain.`)) return;

    try {
      // Get all messages in the thread
      const response = await fetch(`/api/file-transfer/threads/${threadId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      const messageIds = (data.items || []).map((msg: Message) => msg.id);

      // Delete all messages (reusing existing delete message logic)
      for (const messageId of messageIds) {
        const deleteResponse = await fetch(`/api/file-transfer/messages/${messageId}`, {
          method: 'DELETE',
        });
        if (!deleteResponse.ok) {
          console.warn(`Failed to delete message ${messageId}`);
        }
      }

      // Refresh messages and threads
      if (selectedThreadId === threadId) {
        await fetchMessages(threadId);
        await fetchThreads();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteThread = async (threadId: string, threadName: string) => {
    if (!confirm(`Are you sure you want to delete the thread "${threadName}"? This will delete all messages and files in this thread.`)) return;

    try {
      const response = await fetch(`/api/file-transfer/threads/${threadId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete thread');

      // Clear selected thread if it was the deleted one
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('fileTransfer_selectedThreadId');
        }
      }

      // Refresh threads list
      await fetchThreads();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDownloadFile = async (messageId: string, fileName: string) => {
    try {
      const url = `/api/file-transfer/files/${messageId}/${encodeURIComponent(fileName)}?download=true`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download file');

      // Extract filename from Content-Disposition header
      let downloadFileName = fileName;
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        // Try RFC 5987 encoded filename first (filename*=UTF-8''...)
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
        if (filenameStarMatch && filenameStarMatch[1]) {
          try {
            downloadFileName = decodeURIComponent(filenameStarMatch[1]);
          } catch (e) {
            // If decoding fails, fall back to regular filename
          }
        } else {
          // Fall back to regular filename parameter
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            // Remove quotes if present
            downloadFileName = filenameMatch[1].replace(/['"]/g, '');
            // Decode URI if needed
            try {
              downloadFileName = decodeURIComponent(downloadFileName);
            } catch (e) {
              // If decoding fails, use as-is
            }
          }
        }
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCopyLink = async (messageId: string, fileName: string, uniqueKey: string) => {
    try {
      const relativeUrl = `/api/file-transfer/files/${messageId}/${encodeURIComponent(fileName)}`;

      const fullUrl = `${window.location.origin}${relativeUrl}`;
      await navigator.clipboard.writeText(fullUrl);

      setCopiedStates(prev => ({ ...prev, [uniqueKey]: true }));

      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [uniqueKey]: false }));
      }, 2000);
    } catch (err: any) {
      console.error('Failed to copy link:', err);
      setError('Failed to copy link to clipboard');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  return (
    <div>
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white font-serif drop-shadow-lg flex items-center gap-3">
            <span className="text-blood text-4xl">»</span> File Transfer
          </h2>
          <p className="text-gray-500 font-mono text-sm mt-1 max-w-2xl">
            Share files across devices. Create threads, upload files with messages, and access from anywhere.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-8 border-l-4 border-blood bg-gradient-to-r from-gray-900 to-black p-6 relative overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blood" />
              <p className="text-blood font-mono text-sm">Error: {error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
        {/* Thread List Sidebar */}
        <div className="bg-charcoal/50 border border-gray-800 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gold font-mono uppercase tracking-widest text-sm">Threads</h3>
            <button
              onClick={() => setShowCreateThread(true)}
              className="p-1.5 border border-gray-600 text-gray-400 hover:border-blood hover:text-blood transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : threads.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No threads yet. Create one to get started.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className={`group relative w-full border transition-all ${selectedThreadId === thread.id
                    ? 'bg-blood/10 border-blood'
                    : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/50'
                    }`}
                >
                  <button
                    onClick={() => setSelectedThreadId(thread.id)}
                    className="w-full text-left p-3 pr-8"
                  >
                    <div className={`font-mono text-sm truncate ${selectedThreadId === thread.id ? 'text-blood' : 'text-gray-300'
                      }`}>
                      {thread.name}
                    </div>
                    {(thread.updated || thread.created) && (
                      <div className="text-[10px] text-gray-500 font-mono mt-1" suppressHydrationWarning>
                        {formatRelativeTime(thread.updated || thread.created)}
                      </div>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteThread(thread.id, thread.name);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 border border-gray-600 text-gray-400 hover:border-blood hover:text-blood transition-all"
                    title="Delete thread"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message View */}
        <div className="lg:col-span-2 bg-charcoal/50 border border-gray-800 flex flex-col">
          {!selectedThreadId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a thread to view messages
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="border-b border-gray-700 p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-mono text-lg">{selectedThread?.name}</h3>
                  {selectedThread?.created && (
                    <div className="text-[10px] text-gray-500 font-mono mt-1" suppressHydrationWarning>
                      Created {formatDate(selectedThread.created)}
                    </div>
                  )}
                </div>
                {selectedThread && (
                  <button
                    onClick={() => handleEmptyThread(selectedThread.id, selectedThread.name)}
                    className="p-1.5 border border-gray-600 text-gray-400 hover:border-blood hover:text-blood transition-all"
                    title="Empty thread (delete all messages)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="text-center py-8 text-gray-400">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No messages yet. Send a message to get started.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className="bg-gray-900/50 border border-gray-700 p-4 relative group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {message.message && (
                            <div className="text-gray-200 mb-2 whitespace-pre-wrap">
                              {message.message}
                            </div>
                          )}

                          {message.file && (
                            <div className="space-y-2">
                              {Array.isArray(message.file) ? (
                                // Multiple files
                                message.file.map((fileRef: string, index: number) => {
                                  const fileName = Array.isArray(message.file_name)
                                    ? message.file_name[index]
                                    : message.file_name || 'download';
                                  const fileSize = Array.isArray(message.file_size)
                                    ? message.file_size[index]
                                    : message.file_size;
                                  const isCopied = copiedStates[`${message.id}-${index}`];
                                  return (
                                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-800/50 border border-gray-700">
                                      <File className="w-4 h-4 text-gray-400" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-gray-300 text-sm font-mono line-clamp-2 break-all">
                                          {fileName}
                                        </div>
                                        {fileSize && (
                                          <div className="text-[10px] text-gray-500 font-mono">
                                            {formatFileSize(fileSize)}
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleCopyLink(message.id, fileName, `${message.id}-${index}`)}
                                        className="p-1.5 border border-gray-600 text-gray-400 hover:border-blood hover:text-blood transition-all"
                                        title="Copy direct link"
                                      >
                                        {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Link className="w-4 h-4" />}
                                      </button>
                                      <button
                                        onClick={() => handleDownloadFile(message.id, fileName)}
                                        className="p-1.5 border border-gray-600 text-gray-400 hover:border-blood hover:text-blood transition-all"
                                        title="Download file"
                                      >
                                        <Download className="w-4 h-4" />
                                      </button>
                                    </div>
                                  );
                                })
                              ) : (
                                // Single file (backward compatibility)
                                <div className="flex items-center gap-2 p-2 bg-gray-800/50 border border-gray-700">
                                  <File className="w-4 h-4 text-gray-400" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-gray-300 text-sm font-mono line-clamp-2 break-all">
                                      {Array.isArray(message.file_name) ? message.file_name[0] : (message.file_name || 'download')}
                                    </div>
                                    {message.file_size && (
                                      <div className="text-[10px] text-gray-500 font-mono">
                                        {formatFileSize(Array.isArray(message.file_size) ? message.file_size[0] : message.file_size)}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleCopyLink(message.id, Array.isArray(message.file_name) ? message.file_name[0] : (message.file_name || 'download'), `${message.id}-single`)}
                                    className="p-1.5 border border-gray-600 text-gray-400 hover:border-blood hover:text-blood transition-all"
                                    title="Copy direct link"
                                  >
                                    {copiedStates[`${message.id}-single`] ? <Check className="w-4 h-4 text-green-500" /> : <Link className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => handleDownloadFile(message.id, Array.isArray(message.file_name) ? message.file_name[0] : (message.file_name || 'download'))}
                                    className="p-1.5 border border-gray-600 text-gray-400 hover:border-blood hover:text-blood transition-all"
                                    title="Download file"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {message.timestamp && (
                            <div className="text-[10px] text-gray-500 font-mono mt-2" suppressHydrationWarning>
                              {formatRelativeTime(message.timestamp)}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 border border-gray-600 text-gray-400 hover:border-blood hover:text-blood transition-all"
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <div className="border-t border-gray-700 p-4 space-y-3">
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-800/50 border border-gray-700">
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-300 text-sm font-mono">{file.name}</span>
                          <span className="text-[10px] text-gray-500">({formatFileSize(file.size)})</span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message (optional)"
                    className="flex-1 px-3 py-2 border border-gray-700 bg-gray-900 text-gray-200 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blood focus:border-blood transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="file-input"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setSelectedFiles(prev => [...prev, ...files]);
                      // Reset the input so the same file can be selected again if needed
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (fileInputRef.current) {
                        fileInputRef.current.click();
                      } else {
                        // Fallback: try to find by ID
                        const input = document.getElementById('file-input') as HTMLInputElement;
                        input?.click();
                      }
                    }}
                    className="px-4 py-2 border border-gray-600 text-gray-400 hover:border-blood hover:text-blood transition-all"
                    title="Attach file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={uploading || (!messageText.trim() && selectedFiles.length === 0)}
                    className="px-4 py-2 bg-transparent border border-gray-600 text-gray-400 hover:border-blood hover:text-blood transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {uploading ? (
                      <span className="text-xs">Uploading...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span className="text-xs font-mono uppercase">Send</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Thread Modal */}
      {showCreateThread && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-charcoal border border-gray-700 p-6 w-full max-w-md">
            <h3 className="text-gold font-mono uppercase tracking-widest text-sm mb-4">
              Create New Thread
            </h3>
            <input
              type="text"
              value={newThreadName}
              onChange={(e) => setNewThreadName(e.target.value)}
              placeholder="Thread name"
              className="w-full px-3 py-2 border border-gray-700 bg-gray-900 text-gray-200 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blood focus:border-blood transition-colors mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateThread();
                } else if (e.key === 'Escape') {
                  setShowCreateThread(false);
                  setNewThreadName('');
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreateThread(false);
                  setNewThreadName('');
                }}
                className="px-4 py-2 border border-gray-600 text-gray-400 hover:border-white hover:text-white transition-all font-mono text-xs uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateThread}
                disabled={creatingThread || !newThreadName.trim()}
                className="px-4 py-2 bg-transparent border border-blood text-blood hover:bg-blood/10 transition-all font-mono text-xs uppercase disabled:opacity-50"
              >
                {creatingThread ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

