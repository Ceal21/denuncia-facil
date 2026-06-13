import React, { useState } from 'react';
import CitizenSidebar from './CitizenSidebar';
import CitizenChatArea from './CitizenChatArea';
import styles from './CitizenView.module.css';

export default function CitizenView() {
  const [mobileShowChat, setMobileShowChat] = useState(false);

  return (
    <div className={styles.layout}>
      <div className={`${styles.panel} ${mobileShowChat ? styles.panelHidden : ''}`}>
        <CitizenSidebar onSelect={() => setMobileShowChat(true)} />
      </div>
      <div className={`${styles.panel} ${!mobileShowChat ? styles.panelHidden : ''}`}>
        <CitizenChatArea onBack={() => setMobileShowChat(false)} />
      </div>
    </div>
  );
}
