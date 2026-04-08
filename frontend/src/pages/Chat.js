import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import UserProfileModal from '../components/UserProfileModal';
import '../styles/Chat.css';

const Chat = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [searchUsers, setSearchUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [viewProfileId, setViewProfileId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchChats();
    pollRef.current = setInterval(fetchChats, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat._id);
      const interval = setInterval(() => fetchMessages(activeChat._id), 3000);
      return () => clearInterval(interval);
    }
  }, [activeChat?._id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = async () => {
    try {
      const { data } = await API.get('/messages/chats');
      setChats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const { data } = await API.get(`/messages/${userId}`);
      setMessages(data);
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
    fetchMessages(chatUser._id);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    setSending(true);
    try {
      await API.post(`/messages/${activeChat._id}`, { content: newMessage });
      setNewMessage('');
      fetchMessages(activeChat._id);
      fetchChats();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChat) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('content', file.name);

    setSending(true);
    try {
      await API.post(`/messages/${activeChat._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchMessages(activeChat._id);
      fetchChats();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const getAvatarUrl = (u) => u?.avatar ? `http://localhost:5000${u.avatar}` : null;
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
                      <span className="search-team">{u.team}</span>
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
                <span className="chat-header-team">{activeChat.team}</span>
              </div>
            </div>

            <div className="chat-messages">
              {messages.map(msg => (
                <div
                  key={msg._id}
                  className={`message ${msg.sender._id === user._id ? 'sent' : 'received'}`}
                >
                  <div className="message-bubble">
                    {msg.messageType === 'image' && msg.file && (
                      <img
                        src={`http://localhost:5000${msg.file.path}`}
                        alt=""
                        className="message-image"
                        onClick={() => window.open(`http://localhost:5000${msg.file.path}`, '_blank')}
                      />
                    )}
                    {msg.messageType === 'document' && msg.file && (
                      <div
                        className="message-doc"
                        onClick={() => window.open(`http://localhost:5000${msg.file.path}`, '_blank')}
                      >
                        <span className="file-icon-sm">DOCX</span>
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
                accept=".jpg,.jpeg,.png,.webp,.docx"
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
