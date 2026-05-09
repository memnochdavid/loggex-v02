import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { applyTheme } from '../utils/theme';
import { getApiUrl } from '../config/api';
import { useTranslation } from 'react-i18next';
import { resetMercureSubscription } from '../hooks/useMercure';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import IdleWarningModal from '../components/IdleWarningModal';

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

  const checkAuth = async () => {
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
  };

  const login = async (email, password) => {
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
  };

  const logout = useCallback(async () => {
    try {
      await fetch(getApiUrl('/api/logout'), {
          method: 'POST',
          credentials: 'include'
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }
    resetMercureSubscription();
    setUser(null);
  }, []);

  // Cierre de sesión por inactividad — solo cliente. Activo mientras hay
  // user; al pasar 30 min sin actividad sale modal de aviso (durante 2 min)
  // y luego logout automático. El JWT del backend mantiene su TTL nativo
  // (1h) como red de seguridad.
  const { warning: idleWarning, secondsLeft, extend: extendIdle } = useIdleTimeout({
    enabled: !!user,
    idleMs: 30 * 60 * 1000,
    warningOffsetMs: 2 * 60 * 1000,
    onExpire: logout,
  });

  // "Seguir conectado": además de resetear el timer local, pinga al backend
  // (`/api/me`) para ejercitar la cookie de sesión. Si el ping falla por 401,
  // el checkAuth pone user=null y el AuthProvider redirigirá al login.
  const handleContinueIdle = useCallback(async () => {
    extendIdle();
    try { await checkAuth(); } catch (_) { /* checkAuth ya gestiona su propio error */ }
  }, [extendIdle]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, checkAuth }}>
      {children}
      {user && (
        <IdleWarningModal
          isOpen={idleWarning}
          secondsLeft={secondsLeft}
          onContinue={handleContinueIdle}
          onLogout={logout}
        />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
