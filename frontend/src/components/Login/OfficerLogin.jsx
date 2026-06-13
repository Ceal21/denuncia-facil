import React from 'react';
import { useApp } from '../../context/AppContext';
import styles from './Login.module.css';

export default function OfficerLogin() {
  const { login } = useApp();

  return (
    <div className={styles.container}>
      <div className={styles.bg} />

      <div className={styles.card}>
        <div className={styles.logoArea}>
          <div className={styles.shield}>
            <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.shieldSvg}>
              <path d="M24 2L4 10V26C4 38.15 12.8 49.46 24 53C35.2 49.46 44 38.15 44 26V10L24 2Z" fill="#003580" />
              <path d="M24 6L8 13V26C8 36.5 15.44 46.3 24 49.5C32.56 46.3 40 36.5 40 26V13L24 6Z" fill="#004bb5" />
              <path d="M20 27L17 24L15 26L20 31L33 18L31 16L20 27Z" fill="#c8a951" strokeWidth="0.5" stroke="#c8a951" />
            </svg>
          </div>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Denuncia Fácil</h1>
            <p className={styles.subtitle}>Panel de Oficiales — PNP</p>
          </div>
        </div>

        <div className={styles.divider} />

        <p className={styles.prompt}>Acceso restringido al personal</p>

        <div className={styles.roles}>
          <button className={`${styles.roleCard} ${styles.officer}`} onClick={() => login('officer')}>
            <div className={styles.roleIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className={styles.roleText}>
              <span className={styles.roleLabel}>Ingresar como oficial</span>
              <span className={styles.roleDesc}>Gestión y revisión de denuncias</span>
            </div>
            <svg className={styles.roleArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <p className={styles.disclaimer}>
          Uso exclusivo del personal autorizado de la PNP.<br />
          Acceso registrado y auditado.
        </p>
      </div>
    </div>
  );
}
