import React, { useState, useEffect } from 'react';
import styles from './CrudHeader.module.css';
import Breadcrumbs from './Breadcrumbs';

const CrudHeader = ({ title, subtitle, logo, middle, children, stackActionsEarly = false, breadcrumbs }) => {
    const [showLottie, setShowLottie] = useState(true);

    useEffect(() => {
        // Leer configuración inicial
        if (window.themeConfig && window.themeConfig.showLottie !== undefined) {
            setShowLottie(window.themeConfig.showLottie);
        }

        // Escuchar cambios en la configuración
        const handleConfigChange = () => {
            if (window.themeConfig && window.themeConfig.showLottie !== undefined) {
                setShowLottie(window.themeConfig.showLottie);
            }
        };

        window.addEventListener('themeConfigChanged', handleConfigChange);
        return () => window.removeEventListener('themeConfigChanged', handleConfigChange);
    }, []);

    // Determinar si el logo es un componente Lottie (React Element) o una imagen (string)
    const isLottie = React.isValidElement(logo);

    // Determinar si debemos mostrar el logo
    // Si es Lottie, depende de showLottie. Si no es Lottie (imagen), siempre se muestra si existe.
    const shouldShowLogo = logo && (!isLottie || showLottie);

    return (
        <div className={`${styles.outer} ${breadcrumbs ? styles.outerWithBreadcrumbs : ''}`}>
            {breadcrumbs && (
                <div className={styles.breadcrumbsRow}>
                    <Breadcrumbs items={breadcrumbs} />
                </div>
            )}
            <div className={`${styles.container} ${stackActionsEarly ? styles.stackActionsEarly : ''}`}>
                <div className={styles.titleGroup}>
                    {shouldShowLogo && (
                        <div className={styles.logoContainer}>
                            {isLottie ? logo : (
                                typeof logo === 'string' ? (
                                    <img src={logo} alt="Logo" className={styles.logo} />
                                ) : (
                                    logo
                                )
                            )}
                        </div>
                    )}
                    <div className={styles.textContainer}>
                        <h1 className={styles.title}>{title}</h1>
                        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                    </div>
                </div>
                {middle && <div className={styles.middle}>{middle}</div>}
                <div className={styles.actions}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default CrudHeader;
