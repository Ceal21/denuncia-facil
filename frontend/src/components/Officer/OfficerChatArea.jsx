import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import StatusBadge from '../shared/StatusBadge';
import { formatTime, formatTimestamp, formatDateSeparator } from '../../utils/helpers';
import styles from './OfficerChatArea.module.css';

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

function renderContent(text) {
  if (!text) return null;
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

function Message({ msg }) {
  if (msg.senderType === 'system') {
    return (
      <div className={styles.systemMsg}>
        <span>{msg.content}</span>
      </div>
    );
  }

  const isOfficer = msg.senderType === 'officer';
  const isCitizen = msg.senderType === 'citizen';
  const isAI = msg.senderType === 'ai';

  return (
    <div className={`${styles.msgRow} ${isCitizen ? styles.citizen : styles.other}`}>
      {!isCitizen && (
        <div className={`${styles.msgAvatar} ${isOfficer ? styles.officerAvatar : styles.aiAvatar}`}>
          {isAI ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </div>
      )}
      <div className={`${styles.bubble} ${isCitizen ? styles.citizenBubble : styles.otherBubble}`}>
        {!isCitizen && (
          <div className={styles.senderLabel}>{isAI ? 'Asistente IA' : (msg.senderName || msg.senderId)}</div>
        )}
        <div className={styles.bubbleContent}>{renderContent(msg.content)}</div>
        <div className={styles.bubbleMeta}>
          <span className={styles.bubbleTime}>{formatTime(msg.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function ResumenPanel({ chat, onClose }) {
  return (
    <div className={styles.resumenPanel}>
      <div className={styles.resumenHeader}>
        <div className={styles.resumenTitle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Resumen del oficial
        </div>
        <button className={styles.resumenClose} onClick={onClose}>×</button>
      </div>

      <div className={styles.resumenBody}>
        {chat.resumen_oficial && (
          <div className={styles.resumenSection}>
            <div className={styles.resumenSectionLabel}>Resumen de triage</div>
            <p className={styles.resumenText}>{chat.resumen_oficial}</p>
          </div>
        )}

        {chat.contenido_formal && (
          <div className={styles.resumenSection}>
            <div className={styles.resumenSectionLabel}>Contenido formal</div>
            <p className={`${styles.resumenText} ${styles.formal}`}>{chat.contenido_formal}</p>
          </div>
        )}

        {chat.draft_state && (
          <>
            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionLabel}>Denunciante</div>
              <div className={styles.dataGrid}>
                <DataRow label="DNI" value={chat.draft_state.datos_generales.dni} />
                <DataRow label="Nombres" value={[chat.draft_state.datos_generales.nombres, chat.draft_state.datos_generales.apellido_paterno, chat.draft_state.datos_generales.apellido_materno].filter(Boolean).join(' ')} />
                <DataRow label="Domicilio" value={[chat.draft_state.datos_domicilio.direccion, chat.draft_state.datos_domicilio.distrito].filter(Boolean).join(', ')} />
              </div>
            </div>

            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionLabel}>Hecho</div>
              <div className={styles.dataGrid}>
                <DataRow label="Modalidad" value={chat.draft_state.denuncia.modalidad} />
                <DataRow label="Fecha" value={chat.draft_state.datos_hecho.fecha} />
                <DataRow label="Hora" value={chat.draft_state.datos_hecho.hora} />
                <DataRow label="Lugar" value={[chat.draft_state.datos_hecho.direccion_hecho, chat.draft_state.datos_hecho.distrito_hecho].filter(Boolean).join(', ')} />
                <DataRow label="Comisaría" value={chat.draft_state.datos_hecho.comisaria_nombre} />
              </div>
            </div>

            {chat.draft_state.denuncia.especies.length > 0 && (
              <div className={styles.resumenSection}>
                <div className={styles.resumenSectionLabel}>Artículos denunciados</div>
                <div className={styles.especiesList}>
                  {chat.draft_state.denuncia.especies.map((e, i) => (
                    <div key={i} className={styles.especieItem}>
                      <span className={styles.especieTipo}>{e.tipo}</span>
                      <span className={styles.especieDesc}>{e.descripcion || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DataRow({ label, value }) {
  if (!value) return null;
  return (
    <div className={styles.dataRow}>
      <span className={styles.dataLabel}>{label}</span>
      <span className={styles.dataValue}>{value}</span>
    </div>
  );
}

export default function OfficerChatArea({ onBack }) {
  const { currentUser, chats, messages, selectedChatId, claimChat, updateChatStatus, closeWithReason } = useApp();
  const [showResumen, setShowResumen] = useState(true);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const messagesEndRef = useRef(null);

  const chat = selectedChatId ? chats[selectedChatId] : null;
  const chatMessages = selectedChatId ? (messages[selectedChatId] || []) : [];
  const isOwner = chat?.officerId === currentUser.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    setShowResumen(true);
    setShowCloseDialog(false);
    setCloseReason('');
  }, [selectedChatId]);

  function handleConfirmClose() {
    if (!closeReason.trim()) return;
    closeWithReason(chat.chatId, closeReason.trim());
    setShowCloseDialog(false);
    setCloseReason('');
  }

  if (!selectedChatId) {
    return (
      <div className={styles.emptyState}>
        <button className={`${styles.backBtn} ${styles.emptyBack}`} onClick={onBack} aria-label="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className={styles.emptyIcon}>
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M42 32a4 4 0 0 1-4 4H14l-8 8V12a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v20z" />
            <path d="M16 20h16M16 28h8" />
          </svg>
        </div>
        <h3 className={styles.emptyTitle}>Selecciona una denuncia para revisar</h3>
        <p className={styles.emptyDesc}>
          Elige una denuncia de la cola o de tus casos activos para revisarla.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
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
              <div className={styles.citizenLine}>
                {chat.citizenName} — {formatTimestamp(chat.createdAt)}
              </div>
            </div>
          </div>

          <div className={styles.headerActions}>
            {chat.status === 'in_review' && isOwner && (
              <>
                <button
                  className={styles.btnToggleResumen}
                  onClick={() => setShowResumen((v) => !v)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {showResumen ? 'Ocultar resumen' : 'Ver resumen'}
                </button>
                <button
                  className={styles.btnSubmit}
                  onClick={() => updateChatStatus(chat.chatId, 'submitted')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Marcar como procesada
                </button>
                <button
                  className={`${styles.btnClose} ${showCloseDialog ? styles.btnCloseActive : ''}`}
                  onClick={() => setShowCloseDialog((v) => !v)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Cerrar
                </button>
              </>
            )}
            {chat.status === 'submitted' && isOwner && (
              <>
                <button
                  className={styles.btnToggleResumen}
                  onClick={() => setShowResumen((v) => !v)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {showResumen ? 'Ocultar resumen' : 'Ver resumen'}
                </button>
                <button
                  className={styles.btnFiscalia}
                  onClick={() => updateChatStatus(chat.chatId, 'fiscalia')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22l-4-9-9-4 19-7z" />
                  </svg>
                  Enviar a Fiscalía
                </button>
              </>
            )}
          </div>
        </header>

        {showCloseDialog && (
          <div className={styles.closeDialog}>
            <div className={styles.closeDialogTitle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Motivo de cierre
            </div>
            <textarea
              className={styles.closeDialogTextarea}
              placeholder="Describe el motivo por el que se cierra este caso…"
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className={styles.closeDialogActions}>
              <button
                className={styles.btnCancelClose}
                onClick={() => { setShowCloseDialog(false); setCloseReason(''); }}
              >
                Cancelar
              </button>
              <button
                className={styles.btnConfirmClose}
                onClick={handleConfirmClose}
                disabled={!closeReason.trim()}
              >
                Confirmar cierre
              </button>
            </div>
          </div>
        )}

        {chat.status === 'pending' && (
          <div className={styles.claimBanner}>
            <div className={styles.claimBannerLeft}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Esta denuncia está pendiente de asignación.</span>
            </div>
            <button className={styles.claimBtn} onClick={() => claimChat(chat.chatId)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Tomar caso
            </button>
          </div>
        )}

        {(chat.status === 'submitted' || chat.status === 'fiscalia' || chat.status === 'closed') && (
          <div className={`${styles.statusBanner} ${chat.status === 'fiscalia' ? styles.statusBannerFiscalia : chat.status === 'closed' ? styles.statusBannerClosed : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {chat.status === 'submitted' && `Denuncia procesada por ${chat.officerName || 'el oficial'}.`}
            {chat.status === 'fiscalia' && 'Oficio enviado a la Fiscalía.'}
            {chat.status === 'closed' && `Denuncia cerrada por ${chat.officerName || 'el oficial'}.`}
          </div>
        )}

        <div className={styles.messages}>
          {chatMessages.map((msg, index) => {
            const prev = chatMessages[index - 1];
            const showSeparator = !prev || !isSameDay(msg.timestamp, prev.timestamp);
            return (
              <React.Fragment key={msg.id}>
                {showSeparator && <DateSeparator date={msg.timestamp} />}
                <Message msg={msg} />
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {(chat.status === 'in_review' || chat.status === 'submitted') && isOwner && showResumen && (
        <ResumenPanel chat={chat} onClose={() => setShowResumen(false)} />
      )}
    </div>
  );
}
