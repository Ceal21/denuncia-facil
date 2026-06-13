import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import StatusBadge from '../shared/StatusBadge';
import TypingIndicator from '../shared/TypingIndicator';
import { formatTime, calculateProgress, formatDateSeparator } from '../../utils/helpers';
import styles from './CitizenChatArea.module.css';

function renderContent(text) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      if (part === '---') return <hr key={j} className={styles.msgDivider} />;
      return part;
    });
    return (
      <React.Fragment key={i}>
        {rendered}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

function isSameDay(ts1, ts2) {
  const a = new Date(ts1), b = new Date(ts2);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function DateSeparator({ date }) {
  return (
    <div className={styles.dateSeparator}>
      <span className={styles.dateSeparatorLabel}>{formatDateSeparator(date)}</span>
    </div>
  );
}

function Message({ msg, isOwn }) {
  if (msg.senderType === 'system') {
    return (
      <div className={styles.systemMsg}>
        <span>{msg.content}</span>
      </div>
    );
  }

  return (
    <div className={`${styles.msgRow} ${isOwn ? styles.own : styles.other}`}>
      {!isOwn && (
        <div className={styles.aiAvatar}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        </div>
      )}
      <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : styles.bubbleOther}`}>
        <div className={styles.bubbleContent}>{renderContent(msg.content)}</div>
        <div className={styles.bubbleMeta}>
          <span className={styles.bubbleTime}>{formatTime(msg.timestamp)}</span>
          {isOwn && (
            <span className={styles.seenTick} title="Entregado">✓✓</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CitizenChatArea({ onBack }) {
  const { currentUser, chats, messages, selectedChatId, sendMessage, typingChats } = useApp();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const chat = selectedChatId ? chats[selectedChatId] : null;
  const chatMessages = selectedChatId ? (messages[selectedChatId] || []) : [];
  const isTyping = selectedChatId ? typingChats.includes(selectedChatId) : false;
  const canInput = chat && (chat.status === 'draft' || chat.status === 'pending_confirmation');
  const progress = chat ? calculateProgress(chat.draft_state) : 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  useEffect(() => {
    if (canInput) inputRef.current?.focus();
  }, [selectedChatId, canInput]);

  function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed || !canInput) return;
    sendMessage(selectedChatId, trimmed);
    setInputValue('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!selectedChatId) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M42 32a4 4 0 0 1-4 4H14l-8 8V12a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v20z" />
            <line x1="16" y1="18" x2="32" y2="18" />
            <line x1="16" y1="24" x2="26" y2="24" />
          </svg>
        </div>
        <h3 className={styles.emptyTitle}>Selecciona una denuncia</h3>
        <p className={styles.emptyDesc}>Elige una de tus denuncias de la lista, o crea una nueva para comenzar.</p>
      </div>
    );
  }

  return (
    <div className={styles.chatArea}>
      <header className={styles.chatHeader}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className={styles.headerInfo}>
            <div className={styles.headerTop}>
              <span className={styles.chatIdLabel}>{chat.chatId}</span>
              <StatusBadge status={chat.status} size="sm" />
            </div>
            {(chat.status === 'draft' || chat.status === 'pending_confirmation') && (
              <div className={styles.progressRow}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                </div>
                <span className={styles.progressLabel}>{progress}% completado</span>
              </div>
            )}
          </div>
        </div>
        {chat.officerName && (
          <div className={styles.officerTag}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {chat.officerName}
          </div>
        )}
      </header>

      {chat.status === 'pending_confirmation' && (
        <div className={styles.confirmBanner}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Revisa el resumen y escribe <strong>&nbsp;sí&nbsp;</strong> para confirmar y enviar tu denuncia.
        </div>
      )}

      <div className={styles.messages}>
        {chatMessages.map((msg, index) => {
          const prev = chatMessages[index - 1];
          const showSeparator = !prev || !isSameDay(msg.timestamp, prev.timestamp);
          return (
            <React.Fragment key={msg.id}>
              {showSeparator && <DateSeparator date={msg.timestamp} />}
              <Message
                msg={msg}
                isOwn={msg.senderType === 'citizen' && msg.senderId === currentUser.id}
              />
            </React.Fragment>
          );
        })}
        {isTyping && (
          <div className={styles.msgRow}>
            <div className={styles.aiAvatar}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <TypingIndicator />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {canInput ? (
        <div className={styles.inputArea}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              chat.status === 'pending_confirmation'
                ? "Escribe 'sí' para confirmar..."
                : 'Escribe tu mensaje...'
            }
            rows={1}
            disabled={isTyping}
          />
          <button
            className={`${styles.sendBtn} ${inputValue.trim() ? styles.sendActive : ''}`}
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      ) : (
        <div className={styles.readonlyBar}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {chat.status === 'pending' && 'Denuncia enviada — pendiente de asignación'}
          {chat.status === 'in_review' && `En revisión por ${chat.officerName || 'un oficial'}`}
          {chat.status === 'submitted' && 'Denuncia procesada'}
          {chat.status === 'fiscalia' && 'Denuncia enviada a la Fiscalía'}
          {chat.status === 'closed' && 'Denuncia cerrada'}
        </div>
      )}
    </div>
  );
}
