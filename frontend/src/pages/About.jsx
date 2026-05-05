import React, { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import styles from './About.module.css';
import {
    Server, Database, Layout as LayoutIcon, Shield, Code, Layers,
    HardDrive, Globe, Palette, Users, Lock, Sparkles, Zap,
    GitBranch, Package, ExternalLink, ArrowRight,
    CalendarClock, FileText, PenLine, Radio,
    BookOpenCheck, MapPin,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useInView from '../hooks/useInView';
import AnimatedBackground from '../components/AnimatedBackground';

/* ========== TILT 3D SUTIL ========== */
const TiltCard = ({ children, className = '', intensity = 6 }) => {
    const ref = useRef(null);
    const [style, setStyle] = useState({});

    const handleMove = (e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rotY = (x - 0.5) * intensity * 2;
        const rotX = (0.5 - y) * intensity * 2;
        setStyle({
            transform: `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`,
            '--px': `${x * 100}%`,
            '--py': `${y * 100}%`,
        });
    };

    const handleLeave = () => setStyle({});

    return (
        <div
            ref={ref}
            className={className}
            style={style}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
        >
            {children}
        </div>
    );
};

/* ========== CONTADOR ANIMADO ========== */
const Counter = ({ to, duration = 1200 }) => {
    const [value, setValue] = useState(0);
    const [ref, inView] = useInView();

    useEffect(() => {
        if (!inView) return;
        const start = performance.now();
        let raf;
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            setValue(Math.round(eased * to));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => raf && cancelAnimationFrame(raf);
    }, [inView, to, duration]);

    return <span ref={ref}>{value}</span>;
};

/* ========== SECCIÓN REVEAL ========== */
const Reveal = ({ children, as: Tag = 'section', delay = 0, className = '' }) => {
    const [ref, inView] = useInView();
    return (
        <Tag
            ref={ref}
            className={`${className} ${styles.reveal} ${inView ? styles.revealIn : ''}`}
            style={{ '--reveal-delay': `${delay}ms` }}
        >
            {children}
        </Tag>
    );
};

const About = () => {
    const { t } = useTranslation();

    const stackCards = [
        {
            id: 'frontend',
            title: t('about.frontend'),
            icon: <LayoutIcon />,
            color: 'primary',
            items: [
                { label: t('about.framework'), value: 'React 19 + Vite 7' },
                { label: t('about.navigation'), value: 'React Router 7' },
                { label: t('about.styles'), value: 'CSS Modules' },
                { label: t('about.icons'), value: 'Lucide React' },
                { label: t('about.i18n'), value: 'i18next' },
                { label: t('about.animations'), value: 'Lottie React' },
                { label: t('about.dragDrop'), value: '@dnd-kit · react-draggable' },
                { label: t('about.signature'), value: 'perfect-freehand' },
                { label: t('about.charts'), value: 'Recharts' },
                { label: t('about.toasts'), value: 'Sonner' },
                { label: t('about.tutorials'), value: 'React Joyride' },
            ],
        },
        {
            id: 'backend',
            title: t('about.backend'),
            icon: <Server />,
            color: 'emerald',
            items: [
                { label: t('about.framework'), value: 'Symfony 8 + API Platform 4' },
                { label: t('about.language'), value: 'PHP 8.4' },
                { label: t('about.api'), value: 'REST (JSON-LD, Hydra)' },
                { label: t('about.security'), value: 'JWT (LexikJWT)' },
                { label: t('about.orm'), value: 'Doctrine ORM 3' },
                { label: t('about.pdf'), value: 'dompdf 3' },
                { label: t('about.email'), value: 'Symfony Mailer' },
                { label: t('about.logging'), value: 'Monolog' },
                { label: t('about.notifications'), value: 'Symfony Notifier' },
                { label: t('about.tests'), value: 'PHPUnit 12' },
                { label: t('about.cors'), value: 'NelmioCorsBundle' },
            ],
        },
        {
            id: 'data',
            title: t('about.data'),
            icon: <Database />,
            color: 'amber',
            items: [
                { label: t('about.engine'), value: 'MariaDB 10.11' },
                { label: t('about.migrations'), value: 'Doctrine Migrations' },
                { label: t('about.storage'), value: 'MinIO (S3)' },
                { label: t('about.filesystem'), value: 'Flysystem · OneUp' },
            ],
        },
        {
            id: 'infra',
            title: t('about.infrastructure'),
            icon: <HardDrive />,
            color: 'violet',
            items: [
                { label: t('about.containers'), value: 'Docker Compose' },
                { label: t('about.proxy'), value: 'Caddy 2 (HTTPS)' },
                { label: t('about.storage'), value: 'MinIO' },
                { label: t('about.persistence'), value: t('about.dockerVolumes') },
            ],
        },
        {
            id: 'realtime',
            title: t('about.realtime'),
            icon: <Radio />,
            color: 'cyan',
            items: [
                { label: t('about.pushSse'), value: 'Mercure Hub' },
                { label: t('about.cacheQueue'), value: 'Redis 7' },
                { label: t('about.jobs'), value: 'Symfony Messenger' },
                { label: t('about.workers'), value: t('about.workersValue') },
                { label: t('about.latency'), value: '< 50 ms' },
            ],
        },
        {
            id: 'catalog',
            title: t('about.catalogTitle'),
            icon: <BookOpenCheck />,
            color: 'rose',
            items: [
                { label: t('about.catalogSource'), value: t('about.catalogSourceValue') },
                { label: t('about.catalogScope'), value: t('about.catalogScopeValue') },
                { label: t('about.catalogTerritory'), value: t('about.catalogTerritoryValue') },
                { label: t('about.catalogOverlay'), value: t('about.catalogOverlayValue') },
                { label: t('about.catalogProvenance'), value: t('about.catalogProvenanceValue') },
            ],
        },
    ];

    const features = [
        { icon: <Palette />, key: 'DynamicTheme' },
        { icon: <Globe />, key: 'Multilang' },
        { icon: <CalendarClock />, key: 'VisualScheduler' },
        { icon: <FileText />, key: 'PdfExport' },
        { icon: <PenLine />, key: 'DigitalSignature' },
        { icon: <Shield />, key: 'SoftDelete' },
        { icon: <Lock />, key: 'GranularSecurity' },
        { icon: <Users />, key: 'Attendance' },
        { icon: <Sparkles />, key: 'Messaging' },
        { icon: <Radio />, key: 'RealTime' },
        { icon: <BookOpenCheck />, key: 'OfficialCatalog' },
        { icon: <MapPin />, key: 'TerritorialCalendar' },
    ];

    const stats = [
        { value: 5, label: t('about.statLanguages'), icon: <Globe /> },
        { value: 31, label: t('about.statEntities'), icon: <Layers /> },
        { value: 4, label: t('about.statRoles'), icon: <Users /> },
        { value: 80, label: t('about.statThemeVars'), suffix: '+', icon: <Palette /> },
    ];

    return (
        <Layout>
            {/* Fondo animado de ondas detrás de todo el resto de la vista (fixed). */}
            <div className={styles.pageBg} aria-hidden="true">
                <AnimatedBackground type="waves" />
            </div>
            <div className={styles.container}>
                {/* ============ HERO ============ */}
                <header className={styles.hero}>
                    <AnimatedBackground forceDefault />
                    <div className={styles.heroContent}>
                        <div className={styles.logoWrap}>
                            <img src="/logo_app.png" alt="Loggex" className={styles.logo} />
                        </div>
                        <h1 className={styles.title}>{t('about.title')}</h1>
                        <p className={styles.tagline}>{t('about.tagline')}</p>
                        <p className={styles.subtitle}>{t('about.subtitle')}</p>
                        <div className={styles.heroMeta}>
                            <span className={styles.heroChip}><Package size={14} /> v0.2</span>
                            <span className={styles.heroChip}><Zap size={14} /> React 19 · Symfony 8</span>
                            <a
                                href="/api/docs"
                                className={styles.heroLink}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {t('about.heroApiDocs')} <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </header>

                {/* ============ DESCRIPCIÓN ============ */}
                <Reveal className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Layers className={styles.icon} /> {t('about.descriptionTitle')}
                    </h2>
                    <p className={styles.descriptionLead}>{t('about.description')}</p>
                </Reveal>

                {/* ============ ARQUITECTURA ============ */}
                <Reveal className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <GitBranch className={styles.icon} /> {t('about.architectureTitle')}
                    </h2>

                    <div className={styles.architecture}>
                        <div className={`${styles.archLayer} ${styles.archClient}`}>
                            <div className={styles.archLabel}>Client</div>
                            <div className={styles.archBox}>
                                <LayoutIcon size={20} />
                                <div>
                                    <strong>React 19</strong>
                                    <span>Vite · Router · CSS Modules</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.archArrow} aria-hidden="true">
                            <span className={styles.archArrowSpacer} aria-hidden="true">·</span>
                            <div className={styles.archArrowBody}>
                                <div className={styles.archArrowLine}>
                                    <span className={styles.archArrowHead} />
                                </div>
                                <span className={styles.archArrowLabel}>HTTPS · JSON-LD</span>
                            </div>
                        </div>
                        <div className={`${styles.archLayer} ${styles.archApi}`}>
                            <div className={styles.archLabel}>API</div>
                            <div className={styles.archBox}>
                                <Server size={20} />
                                <div>
                                    <strong>Symfony 8 + API Platform</strong>
                                    <span>PHP 8.4 · JWT · Doctrine</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.archArrow} aria-hidden="true">
                            <span className={styles.archArrowSpacer} aria-hidden="true">·</span>
                            <div className={styles.archArrowBody}>
                                <div className={styles.archArrowLine}>
                                    <span className={styles.archArrowHead} />
                                </div>
                                <span className={styles.archArrowLabel}>SQL · S3</span>
                            </div>
                        </div>
                        <div className={`${styles.archLayer} ${styles.archData}`}>
                            <div className={styles.archLabel}>Storage</div>
                            <div className={styles.archBox}>
                                <Database size={20} />
                                <div>
                                    <strong>MariaDB · MinIO</strong>
                                    <span>Docker Compose · Caddy 2</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Reveal>

                {/* ============ CTA: MODELO ER ============ */}
                <Reveal className={styles.section}>
                    <Link to="/about/er" className={styles.erCta}>
                        <div className={styles.erCtaGlow} aria-hidden="true" />
                        <div className={styles.erCtaIcon}>
                            <Database size={28} />
                        </div>
                        <div className={styles.erCtaBody}>
                            <span className={styles.erCtaEyebrow}>{t('about.erCtaEyebrow')}</span>
                            <h3 className={styles.erCtaTitle}>{t('about.erCtaTitle')}</h3>
                            <p className={styles.erCtaText}>{t('about.erCtaText')}</p>
                        </div>
                        <div className={styles.erCtaArrow} aria-hidden="true">
                            <ArrowRight size={20} />
                        </div>
                    </Link>
                </Reveal>

                {/* ============ STATS ============ */}
                <Reveal className={styles.statsStrip}>
                    {stats.map((s, i) => (
                        <div key={i} className={styles.statCard} style={{ '--i': i }}>
                            <div className={styles.statIcon}>{s.icon}</div>
                            <div className={styles.statValue}>
                                <Counter to={s.value} />
                                {s.suffix && <span className={styles.statSuffix}>{s.suffix}</span>}
                            </div>
                            <div className={styles.statLabel}>{s.label}</div>
                        </div>
                    ))}
                </Reveal>

                {/* ============ STACK ============ */}
                <Reveal className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Code className={styles.icon} /> {t('about.stackTitle')}
                    </h2>
                    <div className={styles.grid}>
                        {stackCards.map((c, i) => (
                            <TiltCard
                                key={c.id}
                                className={`${styles.card} ${styles[`card_${c.color}`]}`}
                            >
                                <div className={styles.cardGlow} aria-hidden="true" />
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardIconWrap}>{c.icon}</div>
                                    <h3 className={styles.cardTitle}>{c.title}</h3>
                                </div>
                                <ul className={styles.list}>
                                    {c.items.map((it, j) => (
                                        <li key={j}>
                                            <span className={styles.listLabel}>{it.label}</span>
                                            <span className={styles.listValue}>{it.value}</span>
                                        </li>
                                    ))}
                                </ul>
                            </TiltCard>
                        ))}
                    </div>
                </Reveal>

                {/* ============ FEATURES ============ */}
                <Reveal className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Sparkles className={styles.icon} /> {t('about.featuresTitle')}
                    </h2>
                    <div className={styles.featuresGrid}>
                        {features.map((f, i) => (
                            <div key={f.key} className={styles.featureItem} style={{ '--i': i }}>
                                <div className={styles.featureIcon}>{f.icon}</div>
                                <div className={styles.featureBody}>
                                    <h4>{t(`about.feature${f.key}`)}</h4>
                                    <p>{t(`about.feature${f.key}Desc`)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Reveal>

                {/* Los créditos del autor + copyright se renderizan ahora en
                    el Footer del layout (compartido con /about/er y /login). */}
            </div>
        </Layout>
    );
};

export default About;
