import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const PortalContext = createContext(null);

export function PortalProvider({ children }) {
  const [logoUrl, setLogoUrl] = useState(null);
  const [portalName, setPortalName] = useState('Apex Portal');

  const fetchBranding = () => {
    api
      .get('/settings/branding')
      .then((r) => {
        setLogoUrl(r.data.logoUrl);
        setPortalName(r.data.portalName || 'Apex Portal');
      })
      .catch(() => {
        setLogoUrl(null);
      });
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  return (
    <PortalContext.Provider
      value={{ logoUrl, setLogoUrl, portalName, setPortalName, refreshLogo: fetchBranding, refreshBranding: fetchBranding }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used within PortalProvider');
  return ctx;
}
