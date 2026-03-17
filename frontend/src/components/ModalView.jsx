import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Draggable from 'react-draggable';
import Button from './Button';
import styles from './ModalView.module.css';
import useMediaQuery from '../hooks/useMediaQuery';
import Lottie from 'lottie-react';
import pencilAnimation from '../../public/pencil.json';
import { useTranslation } from 'react-i18next';

const ModalView = ({ 
    isOpen, 
    onClose, 
    title, 
    headerIcon, // Nueva prop para icono/Lottie en el header
    children, 
    footer, 
    onSubmit, 
    isSubmitting = false,
    submitText,
    cancelText,
    size = 'medium', // small, medium, large
    showCloseButton = true,
    closeOnOverlayClick = true,
    className = '', // Clase para el contenido (ventana)
    overlayClassName = '', // Clase para el fondo (overlay)
    bodyClassName = '' // Nueva prop para clase del cuerpo
}) => {
    const { t } = useTranslation();
    const nodeRef = useRef(null);
    const [isClosing, setIsClosing] = useState(false);
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [enableDraggable, setEnableDraggable] = useState(true);
    const [showLottie, setShowLottie] = useState(true);
    
    // Detectar si es móvil (coincide con el breakpoint del CSS)
    const isMobile = useMediaQuery('(max-width: 768px)');

    useEffect(() => {
        // Leer configuración inicial
        if (window.themeConfig) {
            if (window.themeConfig.enableDraggableModal !== undefined) {
                setEnableDraggable(window.themeConfig.enableDraggableModal);
            }
            if (window.themeConfig.showLottie !== undefined) {
                setShowLottie(window.themeConfig.showLottie);
            }
        }

        // Escuchar cambios en la configuración
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

    // Lógica para mostrar el icono
    const renderHeaderIcon = () => {
        // Si se pasa un icono explícito
        if (headerIcon) {
            // Si es un elemento React (probablemente Lottie o Icono componente)
            if (React.isValidElement(headerIcon)) {
                // Si es Lottie (asumimos por contexto o tipo, pero simplificamos: si showLottie es false, ocultamos elementos complejos por defecto si queremos ser estrictos, 
                // pero mejor: si es el default (que sabemos que es Lottie) aplicamos la regla.
                // Si el usuario pasa un icono estático (ej <User />), quizás quiera verlo siempre.
                // Para simplificar y cumplir el requerimiento: "la opción de activar / desactivar lotties, también debe afectar al header de los modals"
                // Asumiremos que si showLottie es false, ocultamos cualquier "adorno" gráfico grande en el header, o específicamente el default.
                
                // Si el usuario pasa un icono, lo respetamos. Si queremos que showLottie afecte a TODO, deberíamos ocultarlo.
                // Pero el requerimiento suele ser para las animaciones pesadas.
                
                // Vamos a aplicar la lógica al DEFAULT Lottie.
                return headerIcon; 
            }
            return headerIcon;
        }

        // Si NO hay icono explícito, usamos el default (Lottie) SOLO si showLottie es true
        if (showLottie) {
            return <Lottie animationData={pencilAnimation} loop={true} style={{ width: 40, height: 40 }} />;
        }

        return null;
    };

    // Ajuste: El requerimiento dice "la opción... debe afectar al header de los modals".
    // Si el headerIcon pasado es un Lottie, debería ocultarse.
    // Como no podemos saber con certeza si un ReactElement es un Lottie sin inspeccionar profundamente,
    // y dado que en CrudHeader ocultamos si es ReactElement, haremos lo mismo aquí para consistencia si se desea un control total.
    // Sin embargo, el caso de uso principal es el Lottie por defecto.
    
    const iconToRender = headerIcon ? (
        // Si hay icono personalizado, decidimos si mostrarlo.
        // Si asumimos que headerIcon PUEDE ser un Lottie, y queremos ocultarlo si showLottie=false:
        showLottie ? headerIcon : null 
        // NOTA: Esto ocultará también iconos estáticos pasados como componentes (<Icon />). 
        // Si eso no es deseado, habría que refinar. Pero basándome en CrudHeader, parece el comportamiento esperado.
    ) : (
        // Si no hay icono, usamos el default solo si showLottie=true
        showLottie ? <Lottie animationData={pencilAnimation} loop={true} style={{ width: 40, height: 40 }} /> : null
    );


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
                    {/* Área de arrastre (Título) - Solo cursor move si no es móvil y draggable está activo */}
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
                            <div className={styles.headerIconContainer}>
                                {iconToRender}
                            </div>
                        )}
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
                
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    <div className={`${styles.modalBody} ${bodyClassName}`}>
                        {children}
                    </div>

                    <div className={styles.modalFooter}>
                        {footer ? footer : (
                            <>
                                {cancelText !== null && ( // Permitir null para ocultar
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
                // En móvil o si draggable está desactivado, renderizamos directamente
                modalContent
            ) : (
                // En escritorio y draggable activo, envolvemos con Draggable
                <Draggable handle=".modal-drag-handle" nodeRef={nodeRef}>
                    {modalContent}
                </Draggable>
            )}
        </div>,
        document.body
    );
};

export default ModalView;
