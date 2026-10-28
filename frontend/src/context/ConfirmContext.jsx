import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

/**
 * Reemplazo modal de window.confirm(). Expone useConfirm() que devuelve una
 * función imperativa: el caller hace `if (!await confirm({ body: '…' })) return;`
 * exactamente igual que con confirm() nativo, pero el diálogo es un ModalView
 * tematizado y no bloquea el hilo principal.
 *
 * Uso:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ body: t('users.confirmDelete') }))) return;
 *   // ... acción destructiva
 *
 * Opciones aceptadas:
 *   - body            (string | ReactNode)  — contenido del diálogo (obligatorio)
 *   - title           (string)              — título de la cabecera
 *   - confirmLabel    (string)              — texto del botón de confirmación
 *   - cancelLabel     (string)              — texto del botón de cancelar
 *   - confirmVariant  ('danger' | 'primary' | …) — variante del botón confirmar
 *   - headerIcon      (ReactNode)           — icono de la cabecera (default AlertTriangle)
 *   - size            ('small' | 'medium')  — tamaño del modal
 */

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
    const [state, setState] = useState({ isOpen: false, options: {} });
    const resolverRef = useRef(null);

    const confirm = useCallback((options = {}) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setState({ isOpen: true, options });
        });
    }, []);

    const finish = useCallback((value) => {
        const resolver = resolverRef.current;
        resolverRef.current = null;
        setState((prev) => ({ ...prev, isOpen: false }));
        if (resolver) resolver(value);
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <ConfirmDialog
                isOpen={state.isOpen}
                onClose={() => finish(false)}
                onConfirm={() => finish(true)}
                {...state.options}
            />
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        throw new Error('useConfirm() debe usarse dentro de <ConfirmProvider>');
    }
    return ctx;
};
