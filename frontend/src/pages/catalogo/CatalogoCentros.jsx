import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import Lottie from 'lottie-react';
import Layout from '../../components/Layout';
import CrudHeader from '../../components/CrudHeader';
import DataProvenanceBanner from '../../components/DataProvenanceBanner';
import { useAuth } from '../../context/AuthContext';
import apiAnimation from '../../../public/api.json';
import crudStyles from '../Crud.module.css';
import styles from './Catalogo.module.css';

/**
 * Stub para la sección "Centros oficiales" del catálogo. Solo accesible
 * por SUPERADMIN porque la ingestión real (Fase 2) aún no está implementada
 * y este es un espacio reservado para cuando llegue.
 *
 * Si un usuario sin rol SUPERADMIN llega aquí, se le redirige al listado
 * de itinerarios — no debería pasar (Sidebar lo gatea), pero lo defendemos
 * en cualquier caso.
 */
const CatalogoCentros = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isSuperAdmin = user?.roles?.includes('ROLE_SUPERADMIN');

    if (!isSuperAdmin) {
        return <Navigate to="/admin/catalogo/itinerarios" replace />;
    }

    return (
        <Layout>
            <div className={crudStyles.container}>
                <CrudHeader
                    title={t('catalogo.centros.title')}
                    subtitle={t('catalogo.centros.subtitle')}
                    breadcrumbs={[
                        { label: t('sidebar.home'), to: '/' },
                        { label: t('catalogo.centros.title') },
                    ]}
                    logo={<Lottie animationData={apiAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                />

                <DataProvenanceBanner />

                <div className={styles.emptyState}>
                    <Building2 size={40} aria-hidden="true" className={styles.emptyStateIcon} />
                    <h2 className={styles.emptyStateTitle}>
                        {t('catalogo.centros.stubTitle')}
                    </h2>
                    <p className={styles.emptyStateText}>
                        {t('catalogo.centros.stubText')}
                    </p>
                </div>
            </div>
        </Layout>
    );
};

export default CatalogoCentros;
