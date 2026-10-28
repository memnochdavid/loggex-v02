import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API_DOCS_URL } from '../config/api';
import {
  Sparkles, Database, FileText, ArrowUpRight,
  Heart, Package, Code2, Layers, BookOpen, Zap,
} from 'lucide-react';
import styles from './Footer.module.css';

const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} aria-label="Footer">
      {/* Borde superior con halo índigo sutil */}
      <div className={styles.topBorder} aria-hidden="true" />

      <div className={styles.inner}>
        {/* ================= COL 1 · Brand ================= */}
        <div className={styles.brand}>
          <div className={styles.brandHeader}>
            <div className={styles.logoWrap}>
              <img src="/logo_app.png" alt="Loggex" className={styles.logo} />
            </div>
            <div className={styles.brandText}>
              <div className={styles.brandName}>Loggex</div>
              <div className={styles.brandVersion}>
                <Package size={10} />
                <span>v0.5</span>
              </div>
            </div>
          </div>

          <p className={styles.brandTag}>
            {t(
              'footer.tagline',
              'Plataforma de gestión académica integral para centros formativos.'
            )}
          </p>

          <div className={styles.heartLine}>
            <Heart size={11} className={styles.heart} />
            <span>
              {t('footer.madeWith', 'Hecho con cuidado, línea a línea')}
            </span>
          </div>
        </div>

        {/* ================= COL 2 · Explora ================= */}
        <div className={styles.col}>
          <h4 className={styles.colTitle}>
            <Sparkles size={11} />
            <span>{t('footer.exploreLabel', 'Explora')}</span>
          </h4>
          <ul className={styles.list}>
            <li>
              <Link to="/about" className={styles.link}>
                <BookOpen size={12} className={styles.linkIcon} />
                <span>{t('footer.aboutLink', 'Acerca del proyecto')}</span>
                <ArrowUpRight size={11} className={styles.linkArrow} />
              </Link>
            </li>
            <li>
              <Link to="/about/er" className={styles.link}>
                <Database size={12} className={styles.linkIcon} />
                <span>{t('footer.erLink', 'Modelo entidad-relación')}</span>
                <ArrowUpRight size={11} className={styles.linkArrow} />
              </Link>
            </li>
            <li>
              <a
                href={API_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                <FileText size={12} className={styles.linkIcon} />
                <span>{t('footer.apiLink', 'Documentación API')}</span>
                <ArrowUpRight size={11} className={styles.linkArrow} />
              </a>
            </li>
          </ul>
        </div>

        {/* ================= COL 3 · Stack ================= */}
        <div className={styles.col}>
          <h4 className={styles.colTitle}>
            <Code2 size={11} />
            <span>{t('footer.stackLabel', 'Stack')}</span>
          </h4>
          <div className={styles.chips}>
            <span className={styles.chip}>React 19</span>
            <span className={styles.chip}>Symfony 8</span>
            <span className={styles.chip}>API Platform</span>
            <span className={styles.chip}>MariaDB</span>
            <span className={styles.chip}>Docker</span>
            <span className={styles.chip}>MinIO</span>
          </div>
        </div>

        {/* ================= COL 4 · Autor ================= */}
        <div className={styles.col}>
          <h4 className={styles.colTitle}>
            <Zap size={11} />
            <span>{t('footer.developedBy')}</span>
          </h4>
          <div className={styles.author}>
            <div className={styles.authorName}>David Duque Díaz</div>
            <div className={styles.authorRole}>{t('footer.role')}</div>
          </div>
        </div>
      </div>

      {/* ================= Barra inferior ================= */}
      <div className={styles.bottomBar}>
        <div className={styles.copyright}>
          {t('footer.copyright', { year })}
        </div>
        <div className={styles.meta}>
          <Layers size={11} />
          <span>React 19 · Symfony 8 · API Platform 3</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
