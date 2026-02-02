import React, { useState } from 'react';
import styles from './AccordionView.module.css';
import { ChevronDown, ChevronUp } from 'lucide-react';

const AccordionItem = ({ item, children, renderHeader, isOpen, onToggle }) => {
  // Si no se controla externamente (isOpen/onToggle), usamos estado local
  const [localIsOpen, setLocalIsOpen] = useState(false);
  const isExpanded = isOpen !== undefined ? isOpen : localIsOpen;
  const toggle = onToggle || (() => setLocalIsOpen(!localIsOpen));

  return (
    <div className={`${styles.accordionItem} ${isExpanded ? styles.activeItem : ''}`}>
      <div 
        className={`${styles.accordionHeader} ${isExpanded ? styles.activeHeader : ''}`} 
        onClick={toggle}
      >
        <div className={styles.headerContent}>
            {renderHeader ? renderHeader(item, isExpanded) : <span>{item.title || item.name}</span>}
        </div>
        <div className={styles.headerIcon}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      
      {isExpanded && (
        <div className={styles.accordionContentWrapper}>
            <div className={styles.accordionContent}>
                {children}
            </div>
        </div>
      )}
    </div>
  );
};

const AccordionView = ({ data, renderItem, renderHeader, expandedId, onToggle }) => {
  return (
    <div className={styles.accordionContainer}>
      {data.map((item, index) => (
        <AccordionItem 
          key={item.id || index} 
          item={item}
          renderHeader={renderHeader}
          isOpen={expandedId !== undefined ? expandedId === (item.id || index) : undefined}
          onToggle={onToggle ? () => onToggle(item.id || index) : undefined}
        >
          {renderItem(item)}
        </AccordionItem>
      ))}
    </div>
  );
};

export default AccordionView;
