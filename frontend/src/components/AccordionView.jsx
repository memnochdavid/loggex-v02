import React, { useState } from 'react';
import styles from './AccordionView.module.css';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';

const AccordionItem = ({ item, children, renderHeader, isOpen, onToggle, onAdd, canAdd }) => {
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
        
        <div className={styles.headerActions}>
            {canAdd && onAdd && (
                <button 
                    className={styles.addButton} 
                    onClick={(e) => {
                        e.stopPropagation();
                        onAdd(item.id);
                    }}
                    title="Añadir"
                >
                    <Plus size={16} /> Añadir
                </button>
            )}
            <div className={styles.headerIcon}>
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
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

const AccordionView = ({ data, renderItem, renderHeader, expandedId, onToggle, onAdd, canAdd }) => {
  return (
    <div className={styles.accordionContainer}>
      {data.map((item, index) => (
        <AccordionItem 
          key={item.id || index} 
          item={item}
          renderHeader={renderHeader}
          isOpen={expandedId !== undefined ? expandedId === (item.id || index) : undefined}
          onToggle={onToggle ? () => onToggle(item.id || index) : undefined}
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
