export const ROLES = {
  SUPERADMIN: 'ROLE_SUPERADMIN',
  ADMIN: 'ROLE_ADMIN',
  PROFESOR: 'ROLE_PROFESOR',
  ALUMNO: 'ROLE_ALUMNO',
};

export const hasRole = (user, role) => {
  if (!user || !user.roles) return false;
  return user.roles.includes(role);
};

export const hasAnyRole = (user, roles) => {
  if (!user || !user.roles) return false;
  return roles.some(role => user.roles.includes(role));
};
