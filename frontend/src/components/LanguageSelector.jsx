import React from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n/i18n';
import styles from './LanguageSelector.module.css';

const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const handleChange = (e) => {
    changeLanguage(e.target.value);
  };

  return (
    <select
      className={styles.selector}
      value={i18n.language}
      onChange={handleChange}
      aria-label="Language"
    >
      <option value="es">ES</option>
      <option value="en">EN</option>
    </select>
  );
};

export default LanguageSelector;
