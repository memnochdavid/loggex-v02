import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import ModalView from './ModalView';
import Button from './Button';

/**
 * Diálogo de confirmación genérico — mismo patrón que ConfirmLogoutModal,
 * pero parametrizado para servir a cualquier acción destructiva o irreversible
 * que antes resolvía window.confirm(). Habitualmente se usa a través del hook
 * useConfirm() (ConfirmContext), que monta una única instancia y la controla
 * de forma imperativa con Promise.
 */
const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    body,
    confirmLabel,
    cancelLabel,
    confirmVariant = 'danger',
    headerIcon,
    size = 'small',
}) => {
    const { t } = useTranslation();

    return (
        <ModalView
            isOpen={isOpen}
            onClose={onClose}
            title={title || t('confirm.title', { defaultValue: 'Confirmar acción' })}
            size={size}
            headerIcon={headerIcon ?? <AlertTriangle size={22} />}
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {cancelLabel || t('confirm.cancel', { defaultValue: 'Cancelar' })}
                    </Button>
                    <Button type="button" variant={confirmVariant} onClick={onConfirm}>
                        {confirmLabel || t('confirm.confirm', { defaultValue: 'Confirmar' })}
                    </Button>
                </>
            }
        >
            {typeof body === 'string' ? <p>{body}</p> : body}
        </ModalView>
    );
};

export default ConfirmDialog;
