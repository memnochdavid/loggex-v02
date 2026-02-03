import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Draggable from 'react-draggable';
import Button from './Button';
import styles from './ModalView.module.css';

const ModalView = ({ 
    isOpen, 
    onClose, 
    title, 
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

    return (
        <div className={overlayClass} onClick={handleOverlayClick}>
            <Draggable handle=".modal-drag-handle" nodeRef={nodeRef}>
                <div 
                    ref={nodeRef}
                    className={styles.modalContainer}
                    onClick={e => e.stopPropagation()}
                    style={{ maxWidth }}
                >
                    <div className={contentClass}>
                        {/* Header contenedor */}
                        <div className={styles.modalHeader}>
                            {/* Área de arrastre (Título) */}
                            <div className={`modal-drag-handle ${styles.modalTitleContainer}`} style={{ cursor: 'move', flex: 1 }}>
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
            </Draggable>
        </div>
    );
};

export default ModalView;
