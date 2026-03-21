import React from 'react';
import styles from './FormField.module.css';
import crudStyles from '../pages/Crud.module.css';

/**
 * Wrapper de campo de formulario con label y error inline.
 *
 * @param {string} label - Texto del label
 * @param {string} error - Mensaje de error (null si no hay)
 * @param {boolean} required - Muestra indicador de requerido
 * @param {React.ReactNode} children - El input/select/textarea
 * @param {string} className - Clase adicional para el wrapper
 * @param {string} htmlFor - ID del input (para asociar label)
 */
const FormField = ({ label, error, required, children, className, htmlFor }) => {
    return (
        <div className={`${crudStyles.formGroup} ${styles.field} ${error ? styles.hasError : ''} ${className || ''}`}>
            {label && (
                <label className={crudStyles.label} htmlFor={htmlFor}>
                    {label}
                    {required && <span className={styles.required}> *</span>}
                </label>
            )}
            {children}
            <div className={`${styles.errorContainer} ${error ? styles.errorVisible : ''}`}>
                {error && <span className={styles.errorText}>{error}</span>}
            </div>
        </div>
    );
};

export default FormField;
