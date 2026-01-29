import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

// URL base del backend. En desarrollo local con Caddy es https://localhost:8443
// Si usas el proxy de vite, podría ser relativo.
// Vamos a asumir que el frontend sabe dónde está el backend.
const API_URL = 'https://localhost:9443'; // Puerto expuesto en docker-compose para backend HTTPS directo
// OJO: En docker-compose.yml, backend expone 9443:8443 (Caddy interno del backend?) No.
// Revisemos docker-compose.
// Caddy service: 8888:80, 8443:443, 9443:8443.
// Caddyfile: localhost:8443 -> backend:80.
// Entonces https://localhost:8443 es el backend.

// Pero espera, el frontend se sirve en https://localhost (puerto 443 implícito) o http://localhost:8888.
// Si accedemos a https://localhost (Caddy -> Frontend), el backend está en https://localhost:8443.

const BACKEND_URL = 'https://localhost:9443'; 
// Nota: En el init.sh dice "Backend: https://localhost:9443/api/hello"
// Así que usaremos ese puerto.

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/me`, {
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include', // Importante para enviar cookies cross-origin
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
        credentials: 'include', // Importante para recibir y guardar la cookie
      });

      if (response.ok) {
        // Después del login exitoso, pedimos los datos del usuario
        // (Aunque el endpoint login ya los devuelve en mi implementación, es buena práctica confirmar)
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
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
