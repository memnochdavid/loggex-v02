import React, { useState, useEffect } from 'react';
import styles from './CrudHeader.module.css';

const CrudHeader = ({ title, subtitle, logo, children }) => {
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

    return (
        <div className={styles.container}>
            <div className={styles.titleGroup}>
                {logo && (
                    <div className={styles.logoContainer}>
                        {isLottie ? (
                            // Si es Lottie, solo mostrar si showLottie es true
                            showLottie ? logo : null
                        ) : (
                            // Si es imagen (string), mostrar siempre
                            typeof logo === 'string' ? (
                                <img src={logo} alt="Logo" className={styles.logo} />
                            ) : (
                                // Fallback para otros tipos
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
            <div className={styles.actions}>
                {children}
            </div>
        </div>
    );
};

export default CrudHeader;
