import React from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import ModalView from './ModalView';
import Button from './Button';

/**
 * Modal de confirmación antes de cerrar sesión. Mismo patrón que el de
 * "cambios sin guardar" del editor de horarios: ModalView con footer
 * customizado (Cancelar + Cerrar sesión).
 */
const ConfirmLogoutModal = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useTranslation();

    return (
        <ModalView
            isOpen={isOpen}
            onClose={onClose}
            title={t('confirmLogout.title')}
            size="small"
            headerIcon={<LogOut size={22} />}
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t('confirmLogout.cancel')}
                    </Button>
                    <Button type="button" variant="danger" onClick={onConfirm}>
                        {t('confirmLogout.confirm')}
                    </Button>
                </>
            }
        >
            <p>{t('confirmLogout.body')}</p>
        </ModalView>
    );
};

export default ConfirmLogoutModal;
