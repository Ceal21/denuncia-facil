import React from 'react';
import { getStatusLabel, getStatusColor } from '../../utils/helpers';
import styles from './StatusBadge.module.css';

export default function StatusBadge({ status, size = 'md' }) {
  return (
    <span
      className={`${styles.badge} ${styles[size]}`}
      style={{ '--status-color': getStatusColor(status) }}
    >
      <span className={styles.dot} />
      {getStatusLabel(status)}
    </span>
  );
}
