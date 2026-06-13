import React, { useState } from 'react';
import OfficerSidebar from './OfficerSidebar';
import OfficerChatArea from './OfficerChatArea';
import ObjetosEncontrados from './ObjetosEncontrados';
import styles from './OfficerView.module.css';

export default function OfficerView() {
  const [activeView, setActiveView] = useState('denuncias');

  return (
    <div className={styles.layout}>
      <OfficerSidebar activeView={activeView} onViewChange={setActiveView} />
      {activeView === 'denuncias' ? <OfficerChatArea /> : <ObjetosEncontrados />}
    </div>
  );
}
