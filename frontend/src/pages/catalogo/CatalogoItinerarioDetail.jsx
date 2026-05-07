import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Lottie from 'lottie-react';
import Layout from '../../components/Layout';
import CrudHeader from '../../components/CrudHeader';
import DataTable from '../../components/DataTable';
import DataProvenanceBanner from '../../components/DataProvenanceBanner';
import { Skeleton } from '../../components/Skeleton';
import { getApiUrl } from '../../config/api';
import apiAnimation from '../../../public/api.json';
import crudStyles from '../Crud.module.css';
import styles from './Catalogo.module.css';

/**
 * Detalle de un CatalogoItinerario: tarjeta de identificación + tabla
 * read-only de módulos. No permite editar ningún campo (los datos vienen
 * por sincronización). Las materias vienen anidadas en el GET del item
 * gracias al group `catalogo_itinerario:read`.
 */
const CatalogoItinerarioDetail = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const response = await fetch(getApiUrl(`/api/catalogo_itinerarios/${id}`), {
                    headers: { 'Accept': 'application/ld+json' },
                    credentials: 'include',
                });
                if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
                const data = await response.json();
                if (!cancelled) setItem(data);
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id]);

    const formatDate = (iso) => {
        if (!iso) return null;
        try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
    };

    const formatHoras = (n) => (n ? t('catalogo.itinerarioDetail.horasUnit', { n }) : null);

    const moduleColumns = [
        { header: t('catalogo.itinerarioDetail.moduleColumns.orden'), accessor: 'orden' },
        { header: t('catalogo.itinerarioDetail.moduleColumns.codigo'), accessor: 'codigoOficial' },
        { header: t('catalogo.itinerarioDetail.moduleColumns.nombre'), accessor: 'nombre' },
        {
            header: t('catalogo.itinerarioDetail.moduleColumns.tipo'),
            accessor: (m) => (
                <span className={styles.badge}>
                    {t(`catalogo.tipoLabel.${m.tipo}`, m.tipo)}
                </span>
            ),
        },
        { header: t('catalogo.itinerarioDetail.moduleColumns.curso'), accessor: (m) => m.curso ?? '—' },
        { header: t('catalogo.itinerarioDetail.moduleColumns.horas'), accessor: (m) => formatHoras(m.horasTotales) ?? '—' },
        { header: t('catalogo.itinerarioDetail.moduleColumns.horasSem'), accessor: (m) => m.minutosSemanales != null ? `${(m.minutosSemanales / 60).toFixed(2).replace(/\.?0+$/, '')}h` : '—' },
        { header: t('catalogo.itinerarioDetail.moduleColumns.ects'), accessor: (m) => m.ects ?? '—' },
    ];

    const baseBreadcrumbs = [
        { label: t('sidebar.home'), to: '/' },
        { label: t('catalogo.itinerarios.title'), to: '/admin/catalogo/itinerarios' },
    ];

    if (loading) {
        return (
            <Layout>
                <div className={crudStyles.container}>
                    <CrudHeader
                        title={t('catalogo.itinerarioDetail.title')}
                        breadcrumbs={[...baseBreadcrumbs, { label: t('catalogo.itinerarioDetail.title') }]}
                        logo={<Lottie animationData={apiAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                    />
                    <DataProvenanceBanner />
                    <div className={styles.identificationCard}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} style={{ marginBottom: '0.75rem' }}>
                                <Skeleton variant="line" width={['60%', '80%', '45%', '70%', '55%', '85%'][i % 6]} height="0.9em" />
                            </div>
                        ))}
                    </div>
                </div>
            </Layout>
        );
    }

    if (error || !item) {
        return (
            <Layout>
                <div className={crudStyles.container}>
                    <CrudHeader
                        title={t('catalogo.itinerarioDetail.title')}
                        breadcrumbs={[...baseBreadcrumbs, { label: t('catalogo.itinerarioDetail.title') }]}
                        logo={<Lottie animationData={apiAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                    />
                    <div className={crudStyles.errorContainer}>
                        {error ?? t('catalogo.itinerarioDetail.notFound')}
                    </div>
                    <Link to="/admin/catalogo/itinerarios" className={styles.normativaLink}>
                        <ArrowLeft size={14} aria-hidden="true" />
                        {t('catalogo.itinerarioDetail.backToList')}
                    </Link>
                </div>
            </Layout>
        );
    }

    const materias = item.materias || [];
    const vigenciaText = item.vigenteHasta
        ? t('catalogo.itinerarioDetail.vigenteUntil', { date: formatDate(item.vigenteHasta) })
        : (item.vigenteDesde
            ? t('catalogo.itinerarioDetail.vigenteFrom', { date: formatDate(item.vigenteDesde) })
            : null);

    return (
        <Layout>
            <div className={crudStyles.container}>
                <CrudHeader
                    title={item.nombre}
                    subtitle={`${t(`catalogo.etapaLabel.${item.etapa}`, item.etapa)} · ${item.codigoOficial}`}
                    breadcrumbs={[...baseBreadcrumbs, { label: item.nombre }]}
                    logo={<Lottie animationData={apiAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                >
                    <Link to="/admin/catalogo/itinerarios" className={styles.normativaLink}>
                        <ArrowLeft size={14} aria-hidden="true" />
                        {t('catalogo.itinerarioDetail.backToList')}
                    </Link>
                </CrudHeader>

                <DataProvenanceBanner />

                <section className={styles.identificationCard}>
                    <h2 className={styles.sectionTitle}>
                        {t('catalogo.itinerarioDetail.identification')}
                    </h2>
                    <div className={styles.identGrid}>
                        <div className={styles.identItem}>
                            <span className={styles.identLabel}>{t('catalogo.itinerarioDetail.labelDenominacion')}</span>
                            <span className={styles.identValue}>{item.nombre}</span>
                        </div>
                        <div className={styles.identItem}>
                            <span className={styles.identLabel}>{t('catalogo.itinerarioDetail.labelEtapa')}</span>
                            <span className={styles.identValue}>
                                <span className={styles.badge}>
                                    {t(`catalogo.etapaLabel.${item.etapa}`, item.etapa)}
                                </span>
                            </span>
                        </div>
                        <div className={styles.identItem}>
                            <span className={styles.identLabel}>{t('catalogo.itinerarioDetail.labelFamilia')}</span>
                            <span className={item.familia ? styles.identValue : styles.identValueMuted}>
                                {item.familia || '—'}
                            </span>
                        </div>
                        <div className={styles.identItem}>
                            <span className={styles.identLabel}>{t('catalogo.itinerarioDetail.labelNivel')}</span>
                            <span className={item.nivel ? styles.identValue : styles.identValueMuted}>
                                {item.nivel || '—'}
                            </span>
                        </div>
                        <div className={styles.identItem}>
                            <span className={styles.identLabel}>{t('catalogo.itinerarioDetail.labelDuracion')}</span>
                            <span className={item.duracionTotalHoras ? styles.identValue : styles.identValueMuted}>
                                {formatHoras(item.duracionTotalHoras) || '—'}
                            </span>
                        </div>
                        <div className={styles.identItem}>
                            <span className={styles.identLabel}>{t('catalogo.itinerarioDetail.labelEcts')}</span>
                            <span className={item.duracionTotalEcts ? styles.identValue : styles.identValueMuted}>
                                {item.duracionTotalEcts || '—'}
                            </span>
                        </div>
                        <div className={styles.identItem}>
                            <span className={styles.identLabel}>{t('catalogo.itinerarioDetail.labelCcaa')}</span>
                            <span className={item.ccaa ? styles.identValue : styles.identValueMuted}>
                                {item.ccaa || '—'}
                            </span>
                        </div>
                        {vigenciaText && (
                            <div className={styles.identItem}>
                                <span className={styles.identLabel}>{t('catalogo.itinerarioDetail.labelVigencia')}</span>
                                <span className={styles.identValue}>{vigenciaText}</span>
                            </div>
                        )}
                    </div>

                    {item.normativa && (
                        <div className={`${styles.identItem} ${styles.normativaWrap}`}>
                            <span className={styles.identLabel}>{t('catalogo.itinerarioDetail.labelNormativa')}</span>
                            <p className={styles.normativaText}>{item.normativa}</p>
                            {item.boletinUrl && (
                                <a
                                    href={item.boletinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.normativaLink}
                                >
                                    {t('catalogo.itinerarioDetail.viewBoe')}
                                    <ExternalLink size={12} aria-hidden="true" />
                                </a>
                            )}
                            {item.curriculoUrl && (
                                <a
                                    href={item.curriculoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.normativaLink}
                                >
                                    {t('catalogo.itinerarioDetail.viewCurriculo')}
                                    <ExternalLink size={12} aria-hidden="true" />
                                </a>
                            )}
                        </div>
                    )}
                </section>

                <h2 className={styles.subSectionTitle}>
                    {t('catalogo.itinerarioDetail.modules')}
                </h2>

                {materias.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p className={styles.emptyStateText}>
                            {t('catalogo.itinerarioDetail.noModules')}
                        </p>
                    </div>
                ) : (
                    <DataTable
                        tableId="catalogo-itinerario-detail"
                        columns={moduleColumns}
                        data={materias}
                        totalItems={materias.length}
                        itemsPerPage={materias.length || 10}
                        currentPage={1}
                        onPageChange={() => {}}
                        onItemsPerPageChange={() => {}}
                        loading={false}
                        mobileHeaderColumns={2}
                    />
                )}
            </div>
        </Layout>
    );
};

export default CatalogoItinerarioDetail;
