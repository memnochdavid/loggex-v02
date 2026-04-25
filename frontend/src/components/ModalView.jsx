import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
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

/* --------------------------------------------------------------------------
 * Estado global compartido entre instancias de ModalView.
 * Pila LIFO para ESC (solo el top responde), contador para scroll lock e inert.
 * ------------------------------------------------------------------------ */
const modalStack = [];
let scrollLockCount = 0;
let savedBodyOverflow = null;
let savedBodyPaddingRight = null;
let inertCount = 0;
const inertedSiblings = [];

const acquireScrollLock = () => {
    if (scrollLockCount === 0) {
        savedBodyOverflow = document.body.style.overflow;
        savedBodyPaddingRight = document.body.style.paddingRight;
        const sbw = window.innerWidth - document.documentElement.clientWidth;
        if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
        document.body.style.overflow = 'hidden';
    }
    scrollLockCount++;
};

const releaseScrollLock = () => {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
        document.body.style.overflow = savedBodyOverflow ?? '';
        document.body.style.paddingRight = savedBodyPaddingRight ?? '';
        savedBodyOverflow = null;
        savedBodyPaddingRight = null;
    }
};

const applyInert = () => {
    if (inertCount === 0) {
        // Marcar como inert los hijos directos de <body> que NO sean:
        // - portales de modal (marcados por nosotros)
        // - portales permitidos (dropdowns de ThemedSelect, etc.)
        Array.from(document.body.children).forEach(el => {
            if (el.hasAttribute('data-modal-portal')) return;
            if (el.hasAttribute('data-modal-allow-focus')) return;
            if (el.querySelector?.('[data-modal-allow-focus]')) return;
            const hadInert = el.hasAttribute('inert');
            const hadAriaHidden = el.getAttribute('aria-hidden');
            if (!hadInert) el.setAttribute('inert', '');
            el.setAttribute('aria-hidden', 'true');
            inertedSiblings.push({ el, hadInert, hadAriaHidden });
        });
    }
    inertCount++;
};

const releaseInert = () => {
    inertCount = Math.max(0, inertCount - 1);
    if (inertCount === 0) {
        while (inertedSiblings.length) {
            const { el, hadInert, hadAriaHidden } = inertedSiblings.pop();
            if (!hadInert) el.removeAttribute('inert');
            if (hadAriaHidden === null) el.removeAttribute('aria-hidden');
            else el.setAttribute('aria-hidden', hadAriaHidden);
        }
    }
};

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
    const portalRef = useRef(null);
    const triggerRef = useRef(null);
    const overlayDownRef = useRef(false);
    const instanceIdRef = useRef(Symbol('modal'));
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

    // Sincroniza isOpen → shouldRender/isClosing. El desmonte real ocurre en onAnimationEnd.
    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsClosing(false);
        } else if (shouldRender) {
            setIsClosing(true);
        }
    }, [isOpen, shouldRender]);

    // Efectos globales (scroll lock + inert + pila) atados al ciclo de vida visible.
    // IMPORTANTE: capturamos triggerRef y blureamos el elemento disparador AQUÍ, antes
    // de aplicar inert. Si no, durante los ~60ms hasta que el efecto de foco mueve el
    // cursor al modal, el botón que abrió el modal sigue con foco dentro de #root ya
    // marcado como aria-hidden — y Chrome lanza el warning "Blocked aria-hidden on an
    // element because its descendant retained focus".
    useEffect(() => {
        if (!shouldRender) return;
        const id = instanceIdRef.current;
        modalStack.push(id);
        acquireScrollLock();

        triggerRef.current = document.activeElement;
        if (
            triggerRef.current &&
            triggerRef.current !== document.body &&
            typeof triggerRef.current.blur === 'function'
        ) {
            triggerRef.current.blur();
        }

        applyInert();
        return () => {
            const idx = modalStack.indexOf(id);
            if (idx !== -1) modalStack.splice(idx, 1);
            releaseScrollLock();
            releaseInert();
        };
    }, [shouldRender]);

    // Auto-focus al abrir + restore al cerrar.
    // (triggerRef ya quedó capturado en el efecto anterior, antes del inert.)
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                if (!contentRef.current) return;
                const focusable = contentRef.current.querySelector(FOCUSABLE_SELECTOR);
                if (focusable) focusable.focus();
                else contentRef.current.focus();
            }, 60);
            return () => clearTimeout(timer);
        }
        if (!isOpen) {
            const restore = triggerRef.current;
            triggerRef.current = null;
            if (
                restore &&
                typeof restore.focus === 'function' &&
                restore.isConnected
            ) {
                restore.focus();
            }
        }
    }, [isOpen]);

    // Focus trap permisivo (ignora portales marcados con data-modal-allow-focus).
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key !== 'Tab' || !contentRef.current) return;
            const active = document.activeElement;
            const insideModal = contentRef.current.contains(active);
            const insideAllowedPortal = active?.closest?.('[data-modal-allow-focus]');
            if (!insideModal && insideAllowedPortal) return; // dejar navegar al portal
            const focusables = contentRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
            if (focusables.length === 0) {
                e.preventDefault();
                contentRef.current.focus();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (!insideModal) {
                // Foco se escapó fuera del modal y de cualquier portal permitido.
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
                return;
            }
            if (e.shiftKey && active === first) {
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

    // ESC solo lo atiende el modal del tope de la pila.
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e) => {
            if (e.key !== 'Escape' || !closeOnOverlayClick) return;
            if (modalStack[modalStack.length - 1] !== instanceIdRef.current) return;
            onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, closeOnOverlayClick, onClose]);

    const handleClose = useCallback((e) => {
        if (e?.stopPropagation) e.stopPropagation();
        onClose();
    }, [onClose]);

    const handleOverlayMouseDown = (e) => {
        overlayDownRef.current = e.target === e.currentTarget;
    };

    const handleOverlayMouseUp = (e) => {
        const isClickOnOverlay = overlayDownRef.current && e.target === e.currentTarget;
        overlayDownRef.current = false;
        if (isClickOnOverlay && closeOnOverlayClick) handleClose();
    };

    const handleAnimationEnd = (e) => {
        // Solo reaccionamos a la animación del propio modalContent durante el cierre.
        if (!isClosing) return;
        if (e.target !== contentRef.current) return;
        setShouldRender(false);
        setIsClosing(false);
    };

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
                onAnimationEnd={handleAnimationEnd}
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
        <div
            ref={portalRef}
            data-modal-portal=""
            className={overlayClass}
            onMouseDown={handleOverlayMouseDown}
            onMouseUp={handleOverlayMouseUp}
        >
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
