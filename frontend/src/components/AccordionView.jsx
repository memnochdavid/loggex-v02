import React, { useState } from 'react';
import styles from './AccordionView.module.css';
import { ChevronDown } from 'lucide-react';

const AccordionItem = ({ item, children, onAdd, canAdd }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.accordionItem}>
      <div className={styles.accordionHeader} onClick={() => setIsOpen(!isOpen)}>
        <span>{item.title}</span>
        <div className={styles.headerActions}>
          {canAdd && onAdd && (
            <button 
              className={styles.addButton} 
              onClick={(e) => {
                e.stopPropagation(); // Evita que el acordeón se abra/cierre
                onAdd(item.id);
              }}
            >
              Añadir
            </button>
          )}
          <ChevronDown
            className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
            size={20}
          />
        </div>
      </div>
      <div className={`${styles.accordionContentWrapper} ${isOpen ? styles.open : ''}`}>
        <div className={styles.accordionContent}>
            <div className={styles.accordionInner}>
                {children}
            </div>
        </div>
      </div>
    </div>
  );
};

const AccordionView = ({ data, renderItem, onAdd, canAdd }) => {
  return (
    <div className={styles.accordionContainer}>
      {data.map((item) => (
        <AccordionItem 
          key={item.id} 
          item={item}
          onAdd={onAdd}
          canAdd={canAdd}
        >
          {renderItem(item)}
        </AccordionItem>
      ))}
    </div>
  );
};

export default AccordionView;
