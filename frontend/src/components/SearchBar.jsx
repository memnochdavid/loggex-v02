import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';
import styles from './SearchBar.module.css';

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
    placeholder = "Buscar...", 
    fields = [], 
    selectedField, 
    onFieldChange 
}) => {
  const inputRef = useRef(null);

  const handleClear = () => {
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={styles.container}>
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
            placeholder={placeholder}
        />
        {value && (
          <button 
            className={styles.clearButton} 
            onClick={handleClear}
            aria-label="Limpiar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
