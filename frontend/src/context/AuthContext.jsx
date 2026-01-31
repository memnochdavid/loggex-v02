import React, { createContext, useState, useContext, useEffect } from 'react';
import { applyTheme } from '../utils/theme';

const AuthContext = createContext(null);

const BACKEND_URL = 'https://localhost:9443'; 

export const AuthProvider = ({ children }) => {
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
      const response = await fetch(`${BACKEND_URL}/api/me`, {
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include', 
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/login`, {
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
        return { success: false, message: errorData.message || 'Error al iniciar sesión' };
      }
    } catch (error) {
      return { success: false, message: 'Error de conexión con el servidor' };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/logout`, { 
          method: 'POST',
          credentials: 'include'
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
