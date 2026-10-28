import React from 'react';
import { Info, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './DataProvenanceBanner.module.css';

/**
 * Banner reutilizable que advierte al usuario de que los datos visibles
 * provienen de fuentes externas (TodoFP del Ministerio + BOE) y que Loggex
 * NO es la fuente oficial. Se muestra encima de cada vista del catálogo.
 *
 * Compacto a propósito (1-2 líneas + link a /admin/catalogo/acerca con la
 * explicación completa) para no robar espacio al contenido principal.
 */
const DataProvenanceBanner = ({
    lastUpdate = null,
    detailLink = '/admin/catalogo/acerca',
    children,
}) => {
    const { t } = useTranslation();

    return (
        <div className={styles.banner} role="note">
            <Info size={18} className={styles.icon} aria-hidden="true" />
            <div className={styles.body}>
                <span className={styles.text}>
                    {children ?? t('catalogo.banner.default')}
                </span>
                {lastUpdate && (
                    <span className={styles.meta}>
                        {' · '}
                        {t('catalogo.banner.lastUpdate', { date: lastUpdate })}
                    </span>
                )}
                {' · '}
                <Link to={detailLink} className={styles.link}>
                    {t('catalogo.banner.howItWorks')}
                    <ExternalLink size={12} aria-hidden="true" />
                </Link>
            </div>
        </div>
    );
};

export default DataProvenanceBanner;
