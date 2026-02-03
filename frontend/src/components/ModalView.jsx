import React, { useEffect } from 'react';
import { X } from 'lucide-react';
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
    size = 'medium' // small, medium, large
}) => {
    
    // Cerrar con tecla ESC
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const maxWidth = {
        small: '400px',
        medium: '600px',
        large: '900px'
    }[size] || '600px';

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div 
                className={styles.modal} 
                onClick={e => e.stopPropagation()}
                style={{ maxWidth }}
            >
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{title}</h3>
                    <button className={styles.closeButton} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div className={styles.modalBody}>
                        {children}
                    </div>

                    <div className={styles.modalFooter}>
                        {footer ? footer : (
                            <>
                                <Button type="button" variant="secondary" onClick={onClose}>
                                    {cancelText}
                                </Button>
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
};

export default ModalView;
