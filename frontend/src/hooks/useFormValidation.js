import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Hook de validación de formularios con soporte onBlur y onSubmit.
 *
 * @param {Object} rules - Reglas de validación por campo:
 *   { fieldName: { required: bool, minLength: n, maxLength: n, pattern: regex, email: bool, min: n, max: n, custom: fn } }
 *
 * custom(value, formData) debe devolver string de error o null.
 */
const useFormValidation = (rules = {}) => {
    const { t } = useTranslation();
    const [errors, setErrors] = useState({});

    const getMessage = useCallback((rule, fieldRule) => {
        if (fieldRule.message) return fieldRule.message;
        switch (rule) {
            case 'required': return t('validation.required');
            case 'email': return t('validation.email');
            case 'minLength': return t('validation.minLength', { min: fieldRule.minLength });
            case 'maxLength': return t('validation.maxLength', { max: fieldRule.maxLength });
            case 'pattern': return t('validation.pattern');
            case 'min': return t('validation.min', { min: fieldRule.min });
            case 'max': return t('validation.max', { max: fieldRule.max });
            default: return t('validation.invalid');
        }
    }, [t]);

    const validateField = useCallback((name, value, formData = {}) => {
        const fieldRule = rules[name];
        if (!fieldRule) return null;

        const val = typeof value === 'string' ? value.trim() : value;

        if (fieldRule.required && (val === '' || val === null || val === undefined)) {
            return getMessage('required', fieldRule);
        }

        // Solo validar formato si hay valor (campos opcionales vacíos pasan)
        if (val === '' || val === null || val === undefined) return null;

        if (fieldRule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            return getMessage('email', fieldRule);
        }

        if (fieldRule.minLength && typeof val === 'string' && val.length < fieldRule.minLength) {
            return getMessage('minLength', fieldRule);
        }

        if (fieldRule.maxLength && typeof val === 'string' && val.length > fieldRule.maxLength) {
            return getMessage('maxLength', fieldRule);
        }

        if (fieldRule.pattern && !fieldRule.pattern.test(val)) {
            return getMessage('pattern', fieldRule);
        }

        if (fieldRule.min !== undefined && Number(val) < fieldRule.min) {
            return getMessage('min', fieldRule);
        }

        if (fieldRule.max !== undefined && Number(val) > fieldRule.max) {
            return getMessage('max', fieldRule);
        }

        if (fieldRule.custom) {
            return fieldRule.custom(val, formData);
        }

        return null;
    }, [rules, getMessage]);

    const handleBlur = useCallback((e, formData = {}) => {
        const { name, value } = e.target;
        const error = validateField(name, value, formData);
        setErrors(prev => {
            if (error) return { ...prev, [name]: error };
            const next = { ...prev };
            delete next[name];
            return next;
        });
    }, [validateField]);

    const validateAll = useCallback((formData) => {
        const newErrors = {};
        for (const name of Object.keys(rules)) {
            const error = validateField(name, formData[name], formData);
            if (error) newErrors[name] = error;
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [rules, validateField]);

    const clearError = useCallback((name) => {
        setErrors(prev => {
            const next = { ...prev };
            delete next[name];
            return next;
        });
    }, []);

    const clearErrors = useCallback(() => {
        setErrors({});
    }, []);

    return { errors, handleBlur, validateAll, clearError, clearErrors, setErrors };
};

export default useFormValidation;
