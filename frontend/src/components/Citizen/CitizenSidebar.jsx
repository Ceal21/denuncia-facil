import React from 'react';
import { useApp } from '../../context/AppContext';
import StatusBadge from '../shared/StatusBadge';
import { formatTimestamp, getInitials } from '../../utils/helpers';
import styles from './CitizenSidebar.module.css';

export default function CitizenSidebar() {
  const { currentUser, chats, selectedChatId, selectChat, createNewChat, logout } = useApp();

  const myChatIds = Object.keys(chats).filter(
    (id) => chats[id].citizenId === currentUser.id
  );

  const sortedChats = myChatIds
    .map((id) => chats[id])
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const hasDraft = sortedChats.some((c) => c.status === 'draft');

  return (
    <aside className={styles.sidebar}>
      <header className={styles.header}>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatar}>{getInitials(currentUser.name)}</div>
          <div className={styles.onlineDot} />
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{currentUser.name}</span>
          <span className={styles.userRole}>Ciudadano</span>
        </div>
        <button className={styles.logoutBtn} onClick={logout} title="Cerrar sesión">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </header>

      <button
        className={styles.newBtn}
        onClick={createNewChat}
        disabled={hasDraft}
        title={hasDraft ? 'Ya tienes una denuncia en borrador' : undefined}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        Nueva denuncia
      </button>

      <div className={styles.listHeader}>Mis reportes</div>

      <nav className={styles.chatList}>
        {sortedChats.length === 0 && (
          <div className={styles.empty}>
            No tienes denuncias aún.<br />Crea una nueva para empezar.
          </div>
        )}
        {sortedChats.map((chat) => {
          const isActive = chat.chatId === selectedChatId;
          const unread = chat.unreadCount?.citizen || 0;

          return (
            <button
              key={chat.chatId}
              className={`${styles.chatItem} ${isActive ? styles.active : ''}`}
              onClick={() => selectChat(chat.chatId)}
            >
              <div className={styles.chatIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className={styles.chatInfo}>
                <div className={styles.chatTop}>
                  <span className={styles.chatId}>{chat.chatId}</span>
                  <span className={styles.chatTime}>{formatTimestamp(chat.updatedAt)}</span>
                </div>
                <div className={styles.chatMid}>
                  <StatusBadge status={chat.status} size="sm" />
                </div>
                <div className={styles.chatBottom}>
                  <span className={styles.chatPreview}>{chat.lastMessagePreview || 'Sin mensajes'}</span>
                  {unread > 0 && <span className={styles.unreadBadge}>{unread}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
