import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';
import styles from './SearchBar.module.css';
import { useTranslation } from 'react-i18next';

/**
 * @param {string} value - Valor actual del input
 * @param {function} onChange - Callback al cambiar el texto
 * @param {string} placeholder - Placeholder del input
 * @param {Array} fields - Array de objetos { value: string, label: string } para el selector de campos
 * @param {string} selectedField - Campo seleccionado actualmente
 * @param {function} onFieldChange - Callback al cambiar el campo
 */
const SearchBar = ({ 
    value, 
    onChange, 
    placeholder, 
    fields = [], 
    selectedField, 
    onFieldChange 
}) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  const handleClear = () => {
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={styles.container} role="search">
      {fields.length > 0 && (
        <select 
            className={styles.select}
            value={selectedField}
            onChange={(e) => onFieldChange(e.target.value)}
        >
            {fields.map(field => (
                <option key={field.value} value={field.value}>
                    {field.label}
                </option>
            ))}
        </select>
      )}
      
      <div className={styles.inputWrapper}>
        <Search className={styles.icon} size={18} />
        <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || t('searchBar.placeholder')}
            aria-label={placeholder || t('searchBar.placeholder')}
        />
        {value && (
          <button 
            className={styles.clearButton} 
            onClick={handleClear}
            aria-label={t('searchBar.clearLabel')}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
