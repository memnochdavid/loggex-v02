import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import styles from './Breadcrumbs.module.css';

/**
 * Migas de pan para `CrudHeader`. Se renderiza encima del título, refleja
 * la jerarquía de navegación. Cada item con `to` se muestra como link;
 * el último item (= vista actual) es texto plano.
 *
 * Patrón: `[{ label: 'Inicio', to: '/' }, { label: 'Administración', to: '/' }, { label: 'Centros' }]`.
 *
 * Doc: `docs/hoja-de-ruta-pulido-ux.md` R2.1.
 */
const Breadcrumbs = ({ items }) => {
    if (!Array.isArray(items) || items.length === 0) return null;
    return (
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <ol className={styles.list}>
                {items.map((item, idx) => {
                    const isLast = idx === items.length - 1;
                    return (
                        <li key={idx} className={styles.item}>
                            {!isLast && item.to ? (
                                <Link to={item.to} className={styles.link}>{item.label}</Link>
                            ) : (
                                <span className={styles.current} aria-current={isLast ? 'page' : undefined}>{item.label}</span>
                            )}
                            {!isLast && (
                                <ChevronRight size={16} className={styles.separator} aria-hidden="true" />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumbs;
