import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, GitMerge, RefreshCw, AlertTriangle, ScrollText, Database, ShieldCheck } from 'lucide-react';
import Lottie from 'lottie-react';
import Layout from '../../components/Layout';
import CrudHeader from '../../components/CrudHeader';
import apiAnimation from '../../../public/api.json';
import crudStyles from '../Crud.module.css';
import styles from './Catalogo.module.css';

/**
 * Página de procedencia y aviso legal del catálogo educativo oficial.
 * Linkada desde el `DataProvenanceBanner` que aparece en cada vista.
 *
 * No depende de datos remotos: es estática. Documenta el sistema de
 * ingestión, sus fases y limitaciones — alineado con docs/catalogo-oficial.md.
 */
const CatalogoAcerca = () => {
    const { t } = useTranslation();

    return (
        <Layout>
            <div className={crudStyles.container}>
                <CrudHeader
                    title={t('catalogo.acerca.title')}
                    subtitle={t('catalogo.acerca.subtitle')}
                    breadcrumbs={[
                        { label: t('sidebar.home'), to: '/' },
                        { label: t('catalogo.acerca.title') },
                    ]}
                    logo={<Lottie animationData={apiAnimation} loop={true} style={{ width: 56, height: 56 }} />}
                />

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Database size={18} aria-hidden="true" />
                        {t('catalogo.acerca.scopeTitle')}
                    </h2>
                    <p className={styles.lead}>{t('catalogo.acerca.scopeDescription')}</p>
                    <ul className={styles.itemList}>
                        <li>{t('catalogo.acerca.scopeItem1')}</li>
                        <li>{t('catalogo.acerca.scopeItem2')}</li>
                        <li>{t('catalogo.acerca.scopeItem3')}</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <GitMerge size={18} aria-hidden="true" />
                        {t('catalogo.acerca.sourcesTitle')}
                    </h2>
                    <p className={styles.lead}>{t('catalogo.acerca.sourcesDescription')}</p>

                    <div className={styles.sourceCard}>
                        <div className={styles.sourceHeader}>
                            <h3 className={styles.sourceName}>
                                {t('catalogo.acerca.source1Name')}
                            </h3>
                            <a
                                href="https://www.todofp.es"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.sourceLink}
                            >
                                todofp.es
                                <ExternalLink size={12} aria-hidden="true" />
                            </a>
                        </div>
                        <p className={styles.sourceDescription}>
                            {t('catalogo.acerca.source1Description')}
                        </p>
                    </div>

                    <div className={styles.sourceCard}>
                        <div className={styles.sourceHeader}>
                            <h3 className={styles.sourceName}>
                                {t('catalogo.acerca.source2Name')}
                            </h3>
                            <a
                                href="https://www.boe.es"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.sourceLink}
                            >
                                boe.es
                                <ExternalLink size={12} aria-hidden="true" />
                            </a>
                        </div>
                        <p className={styles.sourceDescription}>
                            {t('catalogo.acerca.source2Description')}
                        </p>
                    </div>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <RefreshCw size={18} aria-hidden="true" />
                        {t('catalogo.acerca.refreshTitle')}
                    </h2>
                    <p>{t('catalogo.acerca.refreshDescription')}</p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <AlertTriangle size={18} aria-hidden="true" />
                        {t('catalogo.acerca.limitsTitle')}
                    </h2>
                    <ul className={styles.itemList}>
                        <li>{t('catalogo.acerca.limit1')}</li>
                        <li>{t('catalogo.acerca.limit2')}</li>
                        <li>{t('catalogo.acerca.limit3')}</li>
                    </ul>
                </section>

                <section className={`${styles.section} ${styles.disclaimer}`}>
                    <h2 className={styles.sectionTitle}>
                        <ShieldCheck size={18} aria-hidden="true" />
                        {t('catalogo.acerca.legalTitle')}
                    </h2>
                    <p>{t('catalogo.acerca.legalText')}</p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <ScrollText size={18} aria-hidden="true" />
                        {t('catalogo.acerca.exploreTitle')}
                    </h2>
                    <div className={styles.exploreLinks}>
                        <Link to="/admin/catalogo/itinerarios" className={styles.exploreLink}>
                            {t('catalogo.acerca.exploreItinerarios')}
                        </Link>
                        <Link to="/admin/catalogo/materias" className={styles.exploreLink}>
                            {t('catalogo.acerca.exploreMaterias')}
                        </Link>
                    </div>
                </section>
            </div>
        </Layout>
    );
};

export default CatalogoAcerca;
