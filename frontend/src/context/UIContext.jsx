import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);

  const value = useMemo(() => ({ isSidebarOpen, toggleSidebar, closeSidebar, openSidebar }), [isSidebarOpen, toggleSidebar, closeSidebar, openSidebar]);

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);
