import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Draggable from 'react-draggable';
import Button from './Button';
import styles from './ModalView.module.css';
import useMediaQuery from '../hooks/useMediaQuery';
import Lottie from 'lottie-react';
import pencilAnimation from '../../public/pencil.json';
import { useTranslation } from 'react-i18next';

const FOCUSABLE_SELECTOR =
    'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const ModalView = ({
    isOpen,
    onClose,
    title,
    headerIcon,
    children,
    footer,
    onSubmit,
    isSubmitting = false,
    submitText,
    cancelText,
    size = 'medium',
    showCloseButton = true,
    closeOnOverlayClick = true,
    className = '',
    overlayClassName = '',
    bodyClassName = ''
}) => {
    const { t } = useTranslation();
    const titleId = useId();
    const nodeRef = useRef(null);
    const contentRef = useRef(null);
    const triggerRef = useRef(null);
    const [isClosing, setIsClosing] = useState(false);
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [enableDraggable, setEnableDraggable] = useState(true);
    const [showLottie, setShowLottie] = useState(true);

    const isMobile = useMediaQuery('(max-width: 768px)');

    useEffect(() => {
        if (window.themeConfig) {
            if (window.themeConfig.enableDraggableModal !== undefined) {
                setEnableDraggable(window.themeConfig.enableDraggableModal);
            }
            if (window.themeConfig.showLottie !== undefined) {
                setShowLottie(window.themeConfig.showLottie);
            }
        }

        const handleConfigChange = () => {
            if (window.themeConfig) {
                if (window.themeConfig.enableDraggableModal !== undefined) {
                    setEnableDraggable(window.themeConfig.enableDraggableModal);
                }
                if (window.themeConfig.showLottie !== undefined) {
                    setShowLottie(window.themeConfig.showLottie);
                }
            }
        };

        window.addEventListener('themeConfigChanged', handleConfigChange);
        return () => window.removeEventListener('themeConfigChanged', handleConfigChange);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsClosing(false);
        } else if (shouldRender) {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setShouldRender(false);
                setIsClosing(false);
            }, 180); // --dur-exit (160ms) + pequeño margen
            return () => clearTimeout(timer);
        }
    }, [isOpen, shouldRender]);

    // Body scroll lock mientras el modal está visible
    useEffect(() => {
        if (!shouldRender) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, [shouldRender]);

    // Auto-focus al abrir + restore del trigger al cerrar
    useEffect(() => {
        if (isOpen) {
            triggerRef.current = document.activeElement;
            const t = setTimeout(() => {
                if (!contentRef.current) return;
                const focusable = contentRef.current.querySelector(FOCUSABLE_SELECTOR);
                if (focusable) {
                    focusable.focus();
                } else {
                    contentRef.current.focus();
                }
            }, 60);
            return () => clearTimeout(t);
        }
        if (!isOpen && triggerRef.current && typeof triggerRef.current.focus === 'function') {
            triggerRef.current.focus();
            triggerRef.current = null;
        }
    }, [isOpen]);

    // Focus trap: Tab/Shift+Tab ciclan dentro del modal
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key !== 'Tab' || !contentRef.current) return;
            const focusables = contentRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
            if (focusables.length === 0) {
                e.preventDefault();
                contentRef.current.focus();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || !contentRef.current.contains(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen]);

    const handleClose = (e) => {
        if (e) e.stopPropagation();
        setIsClosing(true);
        onClose();
    };

    const handleOverlayClick = (e) => {
        if (closeOnOverlayClick) {
            handleClose(e);
        }
    };

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && closeOnOverlayClick) handleClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, closeOnOverlayClick]);

    if (!shouldRender) return null;

    const maxWidth = {
        small: '400px',
        medium: '600px',
        large: '900px'
    }[size] || '600px';

    const overlayClass = `${styles.modalOverlay} ${isClosing ? styles.closing : ''} ${overlayClassName}`;
    const contentClass = `${styles.modalContent} ${isClosing ? styles.closing : ''} ${className}`;

    const iconToRender = headerIcon ? (
        showLottie ? headerIcon : null
    ) : (
        showLottie ? <Lottie animationData={pencilAnimation} loop={true} style={{ width: 40, height: 40 }} /> : null
    );

    const modalContent = (
        <div
            ref={nodeRef}
            className={styles.modalContainer}
            onClick={e => e.stopPropagation()}
            style={!isMobile ? { maxWidth } : {}}
        >
            <div
                ref={contentRef}
                className={contentClass}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className={styles.modalHeader}>
                    <div
                        className={`modal-drag-handle ${styles.modalTitleContainer}`}
                        style={{
                            cursor: (!isMobile && enableDraggable) ? 'move' : 'default',
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}
                    >
                        {iconToRender && (
                            <div className={styles.headerIconContainer} aria-hidden="true">
                                {iconToRender}
                            </div>
                        )}
                        <h3 id={titleId} className={styles.modalTitle}>{title}</h3>
                    </div>

                    {showCloseButton && (
                        <button
                            className={styles.closeButton}
                            onClick={handleClose}
                            type="button"
                            aria-label={t('modal.close')}
                        >
                            <X size={20} aria-hidden="true" />
                        </button>
                    )}
                </div>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    <div className={`${styles.modalBody} ${bodyClassName}`}>
                        {children}
                    </div>

                    <div className={styles.modalFooter}>
                        {footer ? footer : (
                            <>
                                {cancelText !== null && (
                                    <Button type="button" variant="secondary" onClick={handleClose}>
                                        {cancelText || t('modal.cancel')}
                                    </Button>
                                )}
                                {onSubmit && (
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? t('modal.saving') : (submitText || t('modal.save'))}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );

    return createPortal(
        <div className={overlayClass} onClick={handleOverlayClick}>
            {isMobile || !enableDraggable ? (
                modalContent
            ) : (
                <Draggable handle=".modal-drag-handle" nodeRef={nodeRef}>
                    {modalContent}
                </Draggable>
            )}
        </div>,
        document.body
    );
};

export default ModalView;
