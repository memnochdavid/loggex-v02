import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidNif } from '../utils/nifValidator';

/**
 * Hook genérico de validación de formularios.
 *
 * Recibe un esquema declarativo `{ campo: [reglas] }` y devuelve helpers
 * para validar al blur, al submit y limpiar errores. Se integra con react
 * normal (state local del form) — no impone una librería de forms.
 *
 * Ejemplo:
 *
 *   const { errors, validateField, validateAll, clearError, hasErrors } =
 *     useFormValidation({
 *       email: ['required', 'email'],
 *       password: ['required', { type: 'minLength', value: 8 }],
 *       nif: ['nif'],
 *       telefono: [{ type: 'pattern', value: /^[6-9]\d{8}$/ }],
 *     });
 *
 *   <input
 *     name="email"
 *     value={form.email}
 *     onChange={onChange}
 *     onBlur={() => validateField('email', form.email)}
 *   />
 *   {errors.email && <span className="errorText">{errors.email}</span>}
 *
 *   const handleSubmit = (e) => {
 *     e.preventDefault();
 *     if (!validateAll(form)) return;
 *     // POST...
 *   };
 *
 * Reglas built-in:
 *  - `'required'`: no vacío.
 *  - `'email'`: formato email simple (regex permisivo).
 *  - `'nif'`: DNI/NIE/CIF español válido (helper `isValidNif`).
 *  - `'phoneEs'`: 9 dígitos empezando 6-9 (móvil/fijo ES).
 *  - `{ type: 'minLength', value: 8 }`
 *  - `{ type: 'maxLength', value: 50 }`
 *  - `{ type: 'pattern', value: /regex/, messageKey: 'optional.i18n.key' }`
 *  - `{ type: 'custom', validate: (val, allValues) => boolean | string }`
 *
 * Mensajes de error vienen de i18n (namespace `validation.*`). Cada regla
 * tiene una clave default; las reglas con `messageKey` la sobreescriben.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ES_REGEX = /^[6-9]\d{8}$/;

const isEmpty = (value) =>
    value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

export function useFormValidation(schema) {
    const { t } = useTranslation();
    const [errors, setErrors] = useState({});

    const runRule = useCallback((rule, value, allValues) => {
        // Normaliza atajo string → objeto.
        const r = typeof rule === 'string' ? { type: rule } : rule;
        switch (r.type) {
            case 'required':
                return isEmpty(value)
                    ? t('validation.required', { defaultValue: 'Este campo es obligatorio' })
                    : null;
            case 'email':
                if (isEmpty(value)) return null; // 'email' sin 'required' → vacío válido
                return EMAIL_REGEX.test(value)
                    ? null
                    : t('validation.email', { defaultValue: 'Email no válido' });
            case 'nif':
                if (isEmpty(value)) return null;
                return isValidNif(value)
                    ? null
                    : t('validation.nif', { defaultValue: 'DNI / NIE / CIF no válido' });
            case 'phoneEs':
                if (isEmpty(value)) return null;
                return PHONE_ES_REGEX.test(String(value).replace(/[\s-]/g, ''))
                    ? null
                    : t('validation.phoneEs', { defaultValue: 'Teléfono no válido (9 dígitos, empezando por 6-9)' });
            case 'minLength':
                if (isEmpty(value)) return null;
                return String(value).length >= r.value
                    ? null
                    : t('validation.minLength', { defaultValue: 'Mínimo {{count}} caracteres', count: r.value });
            case 'maxLength':
                if (isEmpty(value)) return null;
                return String(value).length <= r.value
                    ? null
                    : t('validation.maxLength', { defaultValue: 'Máximo {{count}} caracteres', count: r.value });
            case 'pattern':
                if (isEmpty(value)) return null;
                return r.value.test(String(value))
                    ? null
                    : t(r.messageKey || 'validation.pattern', { defaultValue: 'Formato no válido' });
            case 'custom': {
                const result = r.validate(value, allValues || {});
                if (result === true || result === null || result === undefined) return null;
                if (result === false) {
                    return t(r.messageKey || 'validation.invalid', { defaultValue: 'Valor no válido' });
                }
                // El custom devolvió string → ya es el mensaje.
                return result;
            }
            default:
                return null;
        }
    }, [t]);

    const validateField = useCallback((fieldName, value, allValues) => {
        const rules = schema[fieldName];
        if (!rules) return null;
        for (const rule of rules) {
            const error = runRule(rule, value, allValues);
            if (error) {
                setErrors(prev => ({ ...prev, [fieldName]: error }));
                return error;
            }
        }
        setErrors(prev => {
            if (!prev[fieldName]) return prev;
            const next = { ...prev };
            delete next[fieldName];
            return next;
        });
        return null;
    }, [schema, runRule]);

    const validateAll = useCallback((values) => {
        const newErrors = {};
        Object.keys(schema).forEach(fieldName => {
            const rules = schema[fieldName];
            for (const rule of rules) {
                const error = runRule(rule, values[fieldName], values);
                if (error) {
                    newErrors[fieldName] = error;
                    break;
                }
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [schema, runRule]);

    const clearError = useCallback((fieldName) => {
        setErrors(prev => {
            if (!prev[fieldName]) return prev;
            const next = { ...prev };
            delete next[fieldName];
            return next;
        });
    }, []);

    const clearAll = useCallback(() => setErrors({}), []);

    const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

    return { errors, validateField, validateAll, clearError, clearAll, hasErrors };
}
