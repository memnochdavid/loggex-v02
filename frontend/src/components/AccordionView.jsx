import React, { useState } from 'react';
import styles from './AccordionView.module.css';
import { ChevronDown, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AccordionItem = ({ item, children, renderHeader, isOpen, onToggle, onAdd, canAdd, defaultOpen }) => {
  const { t } = useTranslation();
  // Si no se controla externamente (isOpen/onToggle), usamos estado local
  // Inicializamos el estado local con defaultOpen si está presente
  const [localIsOpen, setLocalIsOpen] = useState(defaultOpen || false);

  // Determinar si está abierto (controlado o local)
  const isExpanded = isOpen !== undefined ? isOpen : localIsOpen;
  
  // Función de toggle (controlada o local)
  const handleToggle = () => {
      if (onToggle) {
          onToggle();
      } else {
          setLocalIsOpen(!localIsOpen);
      }
  };

  return (
    <div className={`${styles.accordionItem} ${isExpanded ? styles.open : ''} accordionItem ${isExpanded ? 'accordionItemOpen' : ''}`}>
      <div className={`${styles.accordionHeader} accordionHeader`} onClick={handleToggle}>
        <div className={`${styles.headerContent} headerContent`}>
            {renderHeader ? renderHeader(item, isExpanded) : <span>{item.title}</span>}
        </div>
        <div className={`${styles.headerActions} headerActions`}>
          {canAdd && onAdd && (
            <button
              className={styles.addAction}
              onClick={(e) => {
                e.stopPropagation();
                onAdd(item.id);
              }}
              title={t('accordion.add')}
              aria-label={t('accordion.add')}
            >
              <Plus size={16} />
            </button>
          )}
          <ChevronDown
            className={`${styles.chevron} ${isExpanded ? styles.open : ''}`}
            size={20}
          />
        </div>
      </div>
      <div className={`${styles.accordionContentWrapper} ${isExpanded ? styles.open : ''} accordionContentWrapper`}>
        <div className={`${styles.accordionContent} accordionContent`}>
            <div className={`${styles.accordionInner} accordionInner`}>
                {children}
            </div>
        </div>
      </div>
    </div>
  );
};

const AccordionView = ({ data, renderItem, renderHeader, expandedId, onToggle, onAdd, canAdd, className, defaultOpenAll }) => {
  return (
    <div className={`${styles.accordionContainer} ${className || ''} accordionContainer`}>
      {data.map((item, index) => (
        <AccordionItem 
          key={item.id || index} 
          item={item}
          renderHeader={renderHeader}
          // Si expandedId está definido (aunque sea null), controlamos la apertura
          isOpen={expandedId !== undefined ? expandedId === item.id : undefined}
          onToggle={onToggle ? () => onToggle(item.id) : undefined}
          onAdd={onAdd}
          canAdd={canAdd}
          defaultOpen={defaultOpenAll} // Pasamos la prop para abrir por defecto
        >
          {renderItem(item)}
        </AccordionItem>
      ))}
    </div>
  );
};

export default AccordionView;
