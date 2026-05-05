import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Guard de ruta:
 *  - Sin sesión → redirige a /login conservando la ruta original.
 *  - Con sesión pero rol no autorizado → redirige a / (home).
 *  - Con sesión y rol autorizado (o sin restricción) → renderiza children.
 *
 * Convención: SuperAdmin pasa cualquier `allowedRoles` automáticamente.
 *
 * Sin prop `allowedRoles` (o array vacío) → cualquier usuario autenticado
 * puede ver la ruta. Equivalente al comportamiento previo.
 *
 * Patrón:
 *   <PrivateRoute allowedRoles={['ROLE_PROFESOR', 'ROLE_ADMIN']}>
 *     <PaginaProfeOAdmin />
 *   </PrivateRoute>
 */
const PrivateRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0) {
    const userRoles = user.roles || [];
    const isSuperAdmin = userRoles.includes('ROLE_SUPERADMIN') || userRoles.includes('ROLE_SUPER_ADMIN');
    const allowed = isSuperAdmin || allowedRoles.some(r => userRoles.includes(r));
    if (!allowed) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default PrivateRoute;
