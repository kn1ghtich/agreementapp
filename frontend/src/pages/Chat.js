import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import UserProfileModal from '../components/UserProfileModal';
import '../styles/Chat.css';

const MESSAGES_LIMIT = 30;

const Chat = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [searchUsers, setSearchUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [viewProfileId, setViewProfileId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const topSentinelRef = useRef(null);
  const messagesStateRef = useRef([]);
  const activeChatRef = useRef(null);
  // Стратегия прокрутки для useLayoutEffect после обновления messages
  const scrollStrategyRef = useRef({ type: 'none' });

  useEffect(() => { messagesStateRef.current = messages; }, [messages]);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  useEffect(() => {
    fetchChats();
    pollRef.current = setInterval(fetchChats, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (activeChat) {
      fetchInitialMessages(activeChat._id);
      const interval = setInterval(pollNewMessages, 3000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?._id]);

  // Применяем стратегию прокрутки после обновления DOM
  useLayoutEffect(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    const s = scrollStrategyRef.current;
    if (s.type === 'initial') {
      container.scrollTop = container.scrollHeight;
    } else if (s.type === 'bottom') {
      container.scrollTop = container.scrollHeight;
    } else if (s.type === 'older' && s.prevHeight != null) {
      container.scrollTop = s.prevTop + (container.scrollHeight - s.prevHeight);
    }
    scrollStrategyRef.current = { type: 'none' };
  }, [messages]);

  // IntersectionObserver для автоподгрузки старых сообщений при скролле вверх
  useEffect(() => {
    if (!hasMoreMessages || loadingOlder) return;
    const node = topSentinelRef.current;
    const root = chatMessagesRef.current;
    if (!node || !root) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchOlderMessages();
    }, { root, rootMargin: '120px 0px 0px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreMessages, loadingOlder, messages.length]);

  const isNearBottom = () => {
    const c = chatMessagesRef.current;
    if (!c) return true;
    return c.scrollHeight - c.scrollTop - c.clientHeight < 150;
  };

  const fetchChats = async () => {
    try {
      const { data } = await API.get('/messages/chats');
      setChats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInitialMessages = async (userId) => {
    try {
      const { data } = await API.get(`/messages/${userId}`, {
        params: { limit: MESSAGES_LIMIT }
      });
      scrollStrategyRef.current = { type: 'initial' };
      setMessages(data.items || []);
      setHasMoreMessages(Boolean(data.hasMore));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOlderMessages = async () => {
    const chat = activeChatRef.current;
    const current = messagesStateRef.current;
    if (!chat || current.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    const container = chatMessagesRef.current;
    const prevHeight = container?.scrollHeight || 0;
    const prevTop = container?.scrollTop || 0;
    try {
      const { data } = await API.get(`/messages/${chat._id}`, {
        params: { limit: MESSAGES_LIMIT, before: current[0].createdAt }
      });
      const older = data.items || [];
      if (older.length > 0) {
        scrollStrategyRef.current = { type: 'older', prevHeight, prevTop };
        setMessages(prev => [...older, ...prev]);
      }
      setHasMoreMessages(Boolean(data.hasMore));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOlder(false);
    }
  };

  const pollNewMessages = async () => {
    const chat = activeChatRef.current;
    if (!chat) return;
    const current = messagesStateRef.current;
    try {
      const params = {};
      if (current.length > 0) {
        params.after = current[current.length - 1].createdAt;
      } else {
        params.limit = MESSAGES_LIMIT;
      }
      const { data } = await API.get(`/messages/${chat._id}`, { params });
      const items = data.items || [];
      if (items.length === 0) return;
      const wasNearBottom = isNearBottom();
      const existing = new Set(current.map(m => m._id));
      const fresh = items.filter(m => !existing.has(m._id));
      if (fresh.length === 0) return;
      if (current.length === 0) {
        scrollStrategyRef.current = { type: 'initial' };
        setMessages(fresh);
        setHasMoreMessages(Boolean(data.hasMore));
      } else {
        if (wasNearBottom) scrollStrategyRef.current = { type: 'bottom' };
        setMessages(prev => [...prev, ...fresh]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchUsers([]);
      return;
    }
    try {
      const { data } = await API.get(`/messages/users?search=${query}`);
      setSearchUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const startChat = (chatUser) => {
    setActiveChat(chatUser);
    setShowSearch(false);
    setSearchQuery('');
    setSearchUsers([]);
    setMessages([]);
    setHasMoreMessages(false);
    // fetchInitialMessages вызовется через useEffect на activeChat
  };

  const appendSentMessage = (msg) => {
    setMessages(prev => {
      if (prev.some(m => m._id === msg._id)) return prev;
      scrollStrategyRef.current = { type: 'bottom' };
      return [...prev, msg];
    });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    setSending(true);
    try {
      const { data } = await API.post(`/messages/${activeChat._id}`, { content: newMessage });
      setNewMessage('');
      appendSentMessage(data);
      fetchChats();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !activeChat) return;

    setSending(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('content', file.name);
        try {
          const { data } = await API.post(`/messages/${activeChat._id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          appendSentMessage(data);
        } catch (err) {
          console.error(`Ошибка отправки ${file.name}:`, err);
        }
      }
      fetchChats();
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const getAvatarUrl = (u) => u?.avatar ? `http://localhost:5000/api/files/${u.avatar}` : null;
  const getInitials = (u) => {
    if (u?.fullName) {
      const parts = u.fullName.split(' ');
      return parts.map(p => p[0]).slice(0, 2).join('').toUpperCase();
    }
    return '?';
  };

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2>Чаты</h2>
          <button className="btn-new-chat" onClick={() => setShowSearch(!showSearch)}>+</button>
        </div>

        {showSearch && (
          <div className="chat-search">
            <input
              type="text"
              placeholder="Найти по ФИО..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              autoFocus
            />
            {searchUsers.length > 0 && (
              <div className="search-results">
                {searchUsers.map(u => (
                  <div key={u._id} className="search-result-item" onClick={() => startChat(u)}>
                    {getAvatarUrl(u) ? (
                      <img src={getAvatarUrl(u)} alt="" className="chat-avatar-sm" />
                    ) : (
                      <div className="chat-avatar-placeholder-sm">{getInitials(u)}</div>
                    )}
                    <div>
                      <span className="search-name">{u.fullName}</span>
                      <span className="search-team">{u.department}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="chat-list">
          {chats.map(chat => (
            <div
              key={chat.user._id}
              className={`chat-item ${activeChat?._id === chat.user._id ? 'active' : ''}`}
              onClick={() => startChat(chat.user)}
            >
              {getAvatarUrl(chat.user) ? (
                <img src={getAvatarUrl(chat.user)} alt="" className="chat-avatar" />
              ) : (
                <div className="chat-avatar-placeholder">{getInitials(chat.user)}</div>
              )}
              <div className="chat-item-info">
                <div className="chat-item-top">
                  <span className="chat-item-name">{chat.user.fullName}</span>
                  <span className="chat-item-time">{formatTime(chat.lastMessage.createdAt)}</span>
                </div>
                <div className="chat-item-bottom">
                  <span className="chat-item-preview">
                    {chat.lastMessage.messageType !== 'text' ? (
                      <span className="chat-file-indicator">
                        {chat.lastMessage.messageType === 'image' ? 'Фото' : 'Документ'}
                      </span>
                    ) : (
                      chat.lastMessage.content?.slice(0, 40)
                    )}
                  </span>
                  {chat.unreadCount > 0 && (
                    <span className="chat-unread">{chat.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {chats.length === 0 && !showSearch && (
            <p className="chat-empty">Нет чатов. Нажмите + чтобы начать</p>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="chat-main">
        {activeChat ? (
          <>
            <div
              className="chat-main-header clickable-user"
              onClick={() => setViewProfileId(activeChat._id)}
            >
              {getAvatarUrl(activeChat) ? (
                <img src={getAvatarUrl(activeChat)} alt="" className="chat-avatar-sm" />
              ) : (
                <div className="chat-avatar-placeholder-sm">{getInitials(activeChat)}</div>
              )}
              <div>
                <h3 className="clickable-name">{activeChat.fullName}</h3>
                <span className="chat-header-team">{activeChat.department}</span>
              </div>
            </div>

            <div className="chat-messages" ref={chatMessagesRef}>
              {hasMoreMessages && (
                <div ref={topSentinelRef} className="chat-load-older">
                  {loadingOlder ? 'Загрузка...' : 'Прокрутите, чтобы загрузить ещё'}
                </div>
              )}
              {messages.map(msg => (
                <div
                  key={msg._id}
                  className={`message ${msg.sender._id === user._id ? 'sent' : 'received'}`}
                >
                  <div className="message-bubble">
                    {msg.messageType === 'image' && msg.file && (
                      <img
                        src={`http://localhost:5000/api/files/${msg.file.fileId}`}
                        alt=""
                        className="message-image"
                        onClick={() => window.open(`http://localhost:5000/api/files/${msg.file.fileId}`, '_blank')}
                      />
                    )}
                    {msg.messageType === 'document' && msg.file && (
                      <div
                        className="message-doc"
                        onClick={() => window.open(`http://localhost:5000/api/files/${msg.file.fileId}/download`, '_blank')}
                      >
                        <span className="file-icon-sm">
                          {(msg.file.originalName.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)}
                        </span>
                        <span>{msg.file.originalName}</span>
                      </div>
                    )}
                    {msg.content && msg.messageType === 'text' && (
                      <p className="message-text">{msg.content}</p>
                    )}
                    <span className="message-time">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={sendMessage}>
              <button
                type="button"
                className="btn-attach"
                onClick={() => fileInputRef.current.click()}
              >
                +
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={sendFile}
                accept=".jpg,.jpeg,.png,.webp,.doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.ods,.odp,.csv,.zip,.rar,.7z"
                multiple
                style={{ display: 'none' }}
              />
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Написать сообщение..."
                disabled={sending}
                className="chat-text-input"
              />
              <button type="submit" className="btn-send" disabled={!newMessage.trim() || sending}>
                &rarr;
              </button>
            </form>
          </>
        ) : (
          <div className="chat-no-active">
            <p>Выберите чат или найдите пользователя</p>
          </div>
        )}
      </div>

      {viewProfileId && (
        <UserProfileModal
          userId={viewProfileId}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </div>
  );
};

export default Chat;
