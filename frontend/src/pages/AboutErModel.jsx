import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Database, Layers } from 'lucide-react';
import Layout from '../components/Layout';
import AnimatedBackground from '../components/AnimatedBackground';
import ErDiagram from '../components/ErDiagram';
import { useTranslation } from 'react-i18next';
import styles from './AboutErModel.module.css';

const AboutErModel = () => {
    const { t } = useTranslation();

    return (
        <Layout>
            <div className={styles.pageBg} aria-hidden="true">
                <AnimatedBackground type="waves" />
            </div>

            <div className={styles.page}>
                <header className={styles.header}>
                    <Link to="/about" className={styles.backLink}>
                        <ArrowLeft size={14} />
                        <span>{t('aboutEr.back')}</span>
                    </Link>
                    <div className={styles.headerMain}>
                        <div className={styles.headerIcon}>
                            <Database />
                        </div>
                        <div>
                            <span className={styles.eyebrow}>
                                <Layers size={12} /> {t('aboutEr.eyebrow')}
                            </span>
                            <h1 className={styles.title}>{t('aboutEr.title')}</h1>
                            <p className={styles.subtitle}>{t('aboutEr.subtitle')}</p>
                        </div>
                    </div>
                </header>

                <section className={styles.diagramWrap}>
                    <ErDiagram />
                </section>
            </div>
        </Layout>
    );
};

export default AboutErModel;
