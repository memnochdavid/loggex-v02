import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n/i18n';
import styles from './LanguageSelector.module.css';
import { ChevronDown } from 'lucide-react';

const FLAGS = {
  es: (
    <svg viewBox="0 0 750 500" className={styles.flag}>
      <rect width="750" height="500" fill="#c60b1e"/>
      <rect width="750" height="250" y="125" fill="#ffc400"/>
    </svg>
  ),
  en: (
    <svg viewBox="0 0 60 30" className={styles.flag}>
      <clipPath id="s">
        <path d="M0,0 v30 h60 v-30 z"/>
      </clipPath>
      <clipPath id="t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/>
      </clipPath>
      <g clipPath="url(#s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
      </g>
    </svg>
  ),
  ca: (
    <svg viewBox="0 0 750 500" className={styles.flag}>
      <rect width="750" height="500" fill="#ffc400"/>
      <rect width="750" height="55.5" y="55.5" fill="#c60b1e"/>
      <rect width="750" height="55.5" y="166.5" fill="#c60b1e"/>
      <rect width="750" height="55.5" y="277.5" fill="#c60b1e"/>
      <rect width="750" height="55.5" y="388.5" fill="#c60b1e"/>
    </svg>
  ),
  gl: (
    <svg viewBox="0 0 750 500" className={styles.flag}>
      <rect width="750" height="500" fill="#fff"/>
      <path d="M0,0 L750,500 L750,320 L270,0 Z" fill="#0099d8" transform="translate(-135,0)"/>
      <path d="M250,150 L500,350 L450,400 L200,200 Z" fill="#0099d8"/> 
      {/* Simplificación banda azul */}
      <rect width="750" height="500" fill="#fff"/>
      <path d="M0,0 L250,0 L750,333 L750,500 L500,500 L0,166 Z" fill="#0099d8"/>
    </svg>
  ),
  eu: (
    <svg viewBox="0 0 750 500" className={styles.flag}>
      <rect width="750" height="500" fill="#db001c"/>
      <path d="M0,0 L750,500 M750,0 L0,500" stroke="#009543" strokeWidth="75"/>
      <path d="M375,0 V500 M0,250 H750" stroke="#fff" strokeWidth="75"/>
    </svg>
  )
};

// SVG de Galicia corregido para mejor visualización
FLAGS.gl = (
    <svg viewBox="0 0 300 200" className={styles.flag}>
        <rect width="300" height="200" fill="#ffffff"/>
        <path d="M0,0 L100,0 L300,133 L300,200 L200,200 L0,66 Z" fill="#0092CF"/>
    </svg>
);

const LanguageSelector = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const languages = [
    { code: 'es', label: t('lang.es'), flag: FLAGS.es },
    { code: 'en', label: t('lang.en'), flag: FLAGS.en },
    { code: 'ca', label: t('lang.ca'), flag: FLAGS.ca },
    { code: 'gl', label: t('lang.gl'), flag: FLAGS.gl },
    { code: 'eu', label: t('lang.eu'), flag: FLAGS.eu },
  ];

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (langCode) => {
    changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button 
        className={`${styles.button} ${isOpen ? styles.open : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('lang.label')}
        aria-expanded={isOpen}
      >
        <div className={styles.currentSelection}>
          {currentLang.flag}
          <span>{currentLang.label}</span>
        </div>
        <ChevronDown size={14} className={styles.chevron} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`${styles.item} ${lang.code === currentLang.code ? styles.active : ''}`}
              onClick={() => handleSelect(lang.code)}
            >
              {lang.flag}
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
