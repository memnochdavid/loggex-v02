import React from 'react';
import styles from './Button.module.css';

/**
 * Botón reutilizable
 * @param {string} variant - 'primary' | 'secondary' | 'danger'
 * @param {React.ReactNode} children - Contenido del botón
 * @param className
 * @param {object} props - Resto de props (onClick, type, etc.)
 */
const Button = ({ variant = 'primary', children, className, ...props }) => {
  // Combinamos la clase base, la variante y cualquier clase extra pasada por props
  const buttonClass = `
    ${styles.button} 
    ${styles[variant] || styles.primary} 
    ${className || ''}
  `.trim();

  return (
    <button className={buttonClass} {...props}>
      {children}
    </button>
  );
};

export default Button;
