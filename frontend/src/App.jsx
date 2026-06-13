import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Login from './components/Login/Login';
import OfficerLogin from './components/Login/OfficerLogin';
import CitizenView from './components/Citizen/CitizenView';
import OfficerView from './components/Officer/OfficerView';

function getRoute() {
  return window.location.hash.replace(/^#/, '') || '/';
}

function AppContent() {
  const { currentUser } = useApp();
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const handler = () => setRoute(getRoute());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  if (currentUser?.userType === 'citizen') return <CitizenView />;
  if (currentUser?.userType === 'officer') return <OfficerView />;

  if (route === '/oficiales') return <OfficerLogin />;
  return <Login />;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
