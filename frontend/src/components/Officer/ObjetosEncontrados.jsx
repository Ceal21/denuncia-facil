import React, { useState, useMemo, useId } from 'react';
import { useApp } from '../../context/AppContext';
import { formatTimestamp } from '../../utils/helpers';
import styles from './ObjetosEncontrados.module.css';

export default function ObjetosEncontrados() {
  const { currentUser, foundItems, registerFoundItem } = useApp();
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const tiposListId = useId();

  function handleSubmit(e) {
    e.preventDefault();
    if (!tipo.trim() || !descripcion.trim()) return;
    const matchCount = registerFoundItem({ tipo: tipo.trim(), descripcion: descripcion.trim() });
    setLastResult({ tipo: tipo.trim(), matchCount });
    setTipo('');
    setDescripcion('');
  }

  const sortedItems = useMemo(
    () => [...foundItems].sort((a, b) => new Date(b.registradoAt) - new Date(a.registradoAt)),
    [foundItems]
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div>
          <div className={styles.title}>Objetos Encontrados</div>
          <div className={styles.subtitle}>
            {currentUser.officeName} — {sortedItems.length} objeto{sortedItems.length !== 1 ? 's' : ''} registrado{sortedItems.length !== 1 ? 's' : ''}
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Registrar objeto encontrado</div>

          <div className={styles.comisariaInfo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>{currentUser.officeName}{currentUser.officeAddress ? ` — ${currentUser.officeAddress}` : ''}</span>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Tipo de objeto</label>
              <input
                className={styles.input}
                placeholder="Ej: Celular, Billetera/Cartera, Laptop…"
                value={tipo}
                onChange={(e) => { setTipo(e.target.value); setLastResult(null); }}
                required
                list={tiposListId}
              />
              <datalist id={tiposListId}>
                <option value="Celular" />
                <option value="Billetera/Cartera" />
                <option value="Documentos de identidad" />
                <option value="Equipo electrónico" />
                <option value="Llaves" />
                <option value="Joyas" />
                <option value="Efectivo" />
                <option value="Otros" />
              </datalist>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Descripción</label>
              <textarea
                className={styles.textarea}
                placeholder="Describe el objeto: color, marca, estado, características…"
                value={descripcion}
                onChange={(e) => { setDescripcion(e.target.value); setLastResult(null); }}
                rows={3}
                required
              />
            </div>

            <div className={styles.formActions}>
              {lastResult && (
                <div className={`${styles.resultMsg} ${lastResult.matchCount > 0 ? styles.resultMatch : styles.resultNoMatch}`}>
                  {lastResult.matchCount > 0
                    ? `Registrado. Se encontraron ${lastResult.matchCount} denuncia${lastResult.matchCount !== 1 ? 's' : ''} con "${lastResult.tipo}" — ciudadano${lastResult.matchCount !== 1 ? 's' : ''} notificado${lastResult.matchCount !== 1 ? 's' : ''}.`
                    : `Registrado. Sin denuncias coincidentes con "${lastResult.tipo}".`}
                </div>
              )}
              <button
                type="submit"
                className={styles.btnRegister}
                disabled={!tipo.trim() || !descripcion.trim()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Registrar objeto
              </button>
            </div>
          </form>
        </div>

        <div className={styles.listSection}>
          <div className={styles.listTitle}>
            Registro de objetos encontrados
            {sortedItems.length > 0 && <span className={styles.listCount}>{sortedItems.length}</span>}
          </div>

          {sortedItems.length === 0 ? (
            <div className={styles.empty}>No hay objetos registrados aún.</div>
          ) : (
            <div className={styles.list}>
              {sortedItems.map((item) => (
                <div key={item.id} className={styles.itemCard}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemTipo}>{item.tipo}</span>
                    {item.matched_chats.length > 0 ? (
                      <span className={styles.matchBadge}>
                        {item.matched_chats.length} coincidencia{item.matched_chats.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className={styles.noMatchBadge}>Sin coincidencias</span>
                    )}
                  </div>
                  <div className={styles.itemDesc}>{item.descripcion}</div>
                  <div className={styles.itemMeta}>
                    <span>{item.comisaria_nombre}</span>
                    <span className={styles.metaDot}>·</span>
                    <span>{formatTimestamp(item.registradoAt)}</span>
                    <span className={styles.metaDot}>·</span>
                    <span>Por {item.registrado_por_nombre}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
