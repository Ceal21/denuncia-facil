import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import StatusBadge from '../shared/StatusBadge';
import { formatTimestamp, getInitials } from '../../utils/helpers';
import styles from './OfficerSidebar.module.css';

export default function OfficerSidebar({ activeView = 'denuncias', onViewChange, onSelect }) {
  const { currentUser, chats, selectedChatId, selectChat, logout } = useApp();
  const [activeTab, setActiveTab] = useState('queue');
  const [searchQuery, setSearchQuery] = useState('');

  const pendingChats = Object.values(chats)
    .filter((c) =>
      c.status === 'pending' &&
      c.draft_state?.datos_hecho?.distrito_hecho === currentUser.officeDistrict
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const myChats = Object.values(chats)
    .filter((c) => c.officerId === currentUser.id && ['in_review', 'submitted', 'fiscalia'].includes(c.status))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const searchResults = trimmedQuery
    ? Object.values(chats).filter((c) => {
        const dni = c.draft_state?.datos_generales?.dni || '';
        return (
          c.chatId.toLowerCase().includes(trimmedQuery) ||
          dni.includes(trimmedQuery)
        );
      }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    : null;

  const displayChats = searchResults ?? (activeTab === 'queue' ? pendingChats : myChats);

  return (
    <aside className={styles.sidebar}>
      <header className={styles.header}>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatar}>{getInitials(currentUser.name)}</div>
          <div className={styles.badgePill}>{currentUser.badge}</div>
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{currentUser.name}</span>
          <span className={styles.userRole}>Oficial PNP</span>
          {currentUser.officeName && (
            <span className={styles.officeName}>{currentUser.officeName}</span>
          )}
        </div>
        <button className={styles.logoutBtn} onClick={logout} title="Cerrar sesión">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </header>

      <div className={styles.sectionNav}>
        <button
          className={`${styles.sectionBtn} ${activeView === 'denuncias' ? styles.sectionBtnActive : ''}`}
          onClick={() => onViewChange('denuncias')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Denuncias
        </button>
        <button
          className={`${styles.sectionBtn} ${activeView === 'objetos' ? styles.sectionBtnActive : ''}`}
          onClick={() => onViewChange('objetos')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Obj. Encontrados
        </button>
      </div>

      {activeView === 'denuncias' && (
        <>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Buscar por DNI o N° caso…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery('')} title="Limpiar búsqueda">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {!searchResults && (
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'queue' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            Denuncias
            {pendingChats.length > 0 && (
              <span className={styles.tabCount}>{pendingChats.length}</span>
            )}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'mine' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('mine')}
          >
            Mis casos
            {myChats.length > 0 && (
              <span className={`${styles.tabCount} ${styles.tabCountPurple}`}>{myChats.length}</span>
            )}
          </button>
        </div>
        )}

        {searchResults && (
          <div className={styles.searchResultsHeader}>
            {searchResults.length === 0
              ? 'Sin resultados'
              : `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''}`}
          </div>
        )}

      <nav className={styles.chatList}>
        {displayChats.length === 0 && (
          <div className={styles.empty}>
            {searchResults && 'No se encontraron casos con ese DNI o N° de caso.'}
            {!searchResults && activeTab === 'queue' && 'No hay denuncias pendientes en tu distrito.'}
            {!searchResults && activeTab === 'mine' && 'No tienes casos activos en este momento.'}
          </div>
        )}
        {displayChats.map((chat) => {
          const isActive = chat.chatId === selectedChatId;
          const g = chat.draft_state?.datos_generales;
          const citizenName = g?.nombres
            ? `${g.nombres} ${g.apellido_paterno || ''}`.trim()
            : chat.citizenName;
          const dni = g?.dni || null;
          const district = chat.draft_state?.datos_hecho?.distrito_hecho || '—';
          const modalidad = chat.draft_state?.denuncia?.modalidad || null;
          const waitTime = formatTimestamp(chat.createdAt);

          return (
            <button
              key={chat.chatId}
              className={`${styles.chatItem} ${isActive ? styles.active : ''}`}
              onClick={() => { selectChat(chat.chatId); onSelect?.(); }}
            >
              <div className={styles.chatLeft}>
                <div className={styles.citizenAvatar}>{getInitials(citizenName)}</div>
              </div>
              <div className={styles.chatInfo}>
                <div className={styles.chatTop}>
                  <span className={styles.chatName}>{citizenName}</span>
                  <span className={styles.chatId}>{chat.chatId}</span>
                </div>
                {dni && <span className={styles.dniLine}>DNI {dni}</span>}
                <div className={styles.chatMeta}>
                  <span className={styles.districtTag}>{district}</span>
                  <span className={styles.waitTime}>{waitTime}</span>
                </div>
                <div className={styles.chatBottom}>
                  <div className={styles.chatBottomLeft}>
                    <StatusBadge status={chat.status} size="sm" />
                    {modalidad && (
                      <span className={`${styles.modalidadTag} ${styles[`modalidad_${modalidad.replace(/\s+/g, '_')}`]}`}>
                        {modalidad}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </nav>
        </>
      )}
    </aside>
  );
}
