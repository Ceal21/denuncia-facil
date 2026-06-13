import React from 'react';
import CitizenSidebar from './CitizenSidebar';
import CitizenChatArea from './CitizenChatArea';
import styles from './CitizenView.module.css';

export default function CitizenView() {
  return (
    <div className={styles.layout}>
      <CitizenSidebar />
      <CitizenChatArea />
    </div>
  );
}
