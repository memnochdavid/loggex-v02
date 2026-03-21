import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { applyTheme } from '../utils/theme';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // Efecto para aplicar el tema cuando cambia el usuario
  useEffect(() => {
    if (user && user.centro && user.centro.personalizacion) {
        applyTheme(user.centro.personalizacion);
    } else {
        // Resetear tema si no hay usuario o personalización (volver a defaults)
        applyTheme({});
    }
  }, [user]);

  const checkAuth = useCallback(async () => {
    try {
      // Usamos getApiUrl para que sea relativo a la raíz (gestionado por Caddy)
      const response = await fetch(getApiUrl('/api/me'), {
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        return data.user;
      } else {
        setUser(null);
        return null;
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', 
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
            setUser(data.user);
        } else {
            await checkAuth();
        }
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.message || t('login.error') };
      }
    } catch (error) {
      return { success: false, message: t('common.errorConnection') };
    }
  }, [t, checkAuth]);

  const logout = useCallback(async () => {
    try {
      await fetch(getApiUrl('/api/logout'), {
          method: 'POST',
          credentials: 'include'
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout, loading, checkAuth }), [user, login, logout, loading, checkAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
