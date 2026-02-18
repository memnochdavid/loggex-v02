import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Draggable from 'react-draggable';
import Button from './Button';
import styles from './ModalView.module.css';
import useMediaQuery from '../hooks/useMediaQuery';
import Lottie from 'lottie-react';
import pencilAnimation from '../../public/pencil.json';

const ModalView = ({ 
    isOpen, 
    onClose, 
    title, 
    headerIcon, // Nueva prop para icono/Lottie en el header
    children, 
    footer, 
    onSubmit, 
    isSubmitting = false,
    submitText = 'Guardar',
    cancelText = 'Cancelar',
    size = 'medium', // small, medium, large
    showCloseButton = true,
    closeOnOverlayClick = true,
    className = '', // Clase para el contenido (ventana)
    overlayClassName = '' // Clase para el fondo (overlay)
}) => {
    const nodeRef = useRef(null);
    const [isClosing, setIsClosing] = useState(false);
    const [shouldRender, setShouldRender] = useState(isOpen);
    
    // Detectar si es móvil (coincide con el breakpoint del CSS)
    const isMobile = useMediaQuery('(max-width: 768px)');

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsClosing(false);
        } else {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setShouldRender(false);
                setIsClosing(false);
            }, 300); // Duración de la animación
            return () => clearTimeout(timer);
        }
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

    // Cerrar con tecla ESC
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

    // Contenido del modal (común para draggable y no draggable)
    const modalContent = (
        <div 
            ref={nodeRef}
            className={styles.modalContainer}
            onClick={e => e.stopPropagation()}
            style={!isMobile ? { maxWidth } : {}} // En móvil, el CSS controla el ancho
        >
            <div className={contentClass}>
                {/* Header contenedor */}
                <div className={styles.modalHeader}>
                    {/* Área de arrastre (Título) - Solo cursor move si no es móvil */}
                    <div 
                        className={`modal-drag-handle ${styles.modalTitleContainer}`} 
                        style={{ cursor: isMobile ? 'default' : 'move', flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                        <div className={styles.headerIconContainer}>
                            {headerIcon ? headerIcon : (
                                <Lottie animationData={pencilAnimation} loop={true} style={{ width: 40, height: 40 }} />
                            )}
                        </div>
                        <h3 className={styles.modalTitle}>{title}</h3>
                    </div>
                    
                    {/* Botón de cerrar (FUERA del handle) */}
                    {showCloseButton && (
                        <button 
                            className={styles.closeButton} 
                            onClick={handleClose}
                            type="button"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
                
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div className={styles.modalBody}>
                        {children}
                    </div>

                    <div className={styles.modalFooter}>
                        {footer ? footer : (
                            <>
                                {cancelText && (
                                    <Button type="button" variant="secondary" onClick={handleClose}>
                                        {cancelText}
                                    </Button>
                                )}
                                {onSubmit && (
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? 'Guardando...' : submitText}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <div className={overlayClass} onClick={handleOverlayClick}>
            {isMobile ? (
                // En móvil, renderizamos directamente sin Draggable
                modalContent
            ) : (
                // En escritorio, envolvemos con Draggable
                <Draggable handle=".modal-drag-handle" nodeRef={nodeRef}>
                    {modalContent}
                </Draggable>
            )}
        </div>
    );
};

export default ModalView;
