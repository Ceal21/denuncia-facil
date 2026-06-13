import React, { useState } from 'react';
import OfficerSidebar from './OfficerSidebar';
import OfficerChatArea from './OfficerChatArea';
import ObjetosEncontrados from './ObjetosEncontrados';
import styles from './OfficerView.module.css';

export default function OfficerView() {
  const [activeView, setActiveView] = useState('denuncias');
  const [mobileShowChat, setMobileShowChat] = useState(false);

  function handleViewChange(view) {
    setActiveView(view);
    if (view === 'objetos') setMobileShowChat(true);
  }

  return (
    <div className={styles.layout}>
      <div className={`${styles.panel} ${mobileShowChat ? styles.panelHidden : ''}`}>
        <OfficerSidebar activeView={activeView} onViewChange={handleViewChange} onSelect={() => setMobileShowChat(true)} />
      </div>
      <div className={`${styles.panel} ${!mobileShowChat ? styles.panelHidden : ''}`}>
        {activeView === 'denuncias'
          ? <OfficerChatArea onBack={() => setMobileShowChat(false)} />
          : <ObjetosEncontrados onBack={() => { setMobileShowChat(false); setActiveView('denuncias'); }} />}
      </div>
    </div>
  );
}
