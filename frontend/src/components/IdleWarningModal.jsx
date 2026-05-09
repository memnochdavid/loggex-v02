import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import ModalView from './ModalView';
import Button from './Button';

/**
 * Modal de aviso de cierre de sesión por inactividad.
 *
 * Lo dispara `useIdleTimeout` cuando lleva `warningOffsetMs` ms restantes
 * para el logout automático. El countdown viene en `secondsLeft` del hook.
 *
 * El usuario tiene dos opciones explícitas:
 *  - "Seguir conectado" (primary) → `onContinue()` (típicamente extend()
 *    del hook + ping ligero al backend para refrescar la sesión).
 *  - "Cerrar sesión" (secondary) → `onLogout()` (típicamente logout()
 *    del AuthContext).
 *
 * No se puede cerrar haciendo click fuera ni con Escape: la inactividad
 * no es un accidente sin consecuencia, queremos elección consciente.
 *
 * Tematizado: hereda colores del modal estándar; el icono usa el color
 * primario del tema.
 */
const IdleWarningModal = ({ isOpen, secondsLeft, onContinue, onLogout }) => {
    const { t } = useTranslation();

    const minutes = Math.floor(Math.max(0, secondsLeft) / 60);
    const seconds = Math.max(0, secondsLeft) % 60;
    const formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;

    return (
        <ModalView
            isOpen={isOpen}
            onClose={onContinue}
            title={t('session.idleWarningTitle', { defaultValue: '¿Sigues ahí?' })}
            headerIcon={<Clock size={20} />}
            size="small"
            showCloseButton={false}
            closeOnOverlayClick={false}
            footer={
                <>
                    <Button variant="secondary" onClick={onLogout}>
                        {t('session.idleLogoutNow', { defaultValue: 'Cerrar sesión' })}
                    </Button>
                    <Button variant="primary" onClick={onContinue}>
                        {t('session.idleContinue', { defaultValue: 'Seguir conectado' })}
                    </Button>
                </>
            }
        >
            <p style={{ margin: 0, lineHeight: 1.5 }}>
                {t('session.idleWarningBody', {
                    defaultValue: 'Tu sesión se cerrará por inactividad en',
                })}{' '}
                <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-warning, var(--color-primary-500))' }}>
                    {formatted}
                </strong>.
            </p>
            <p style={{ margin: '0.75rem 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                {t('session.idleWarningHint', {
                    defaultValue: 'Pulsa "Seguir conectado" si quieres mantener la sesión abierta.',
                })}
            </p>
        </ModalView>
    );
};

export default IdleWarningModal;
