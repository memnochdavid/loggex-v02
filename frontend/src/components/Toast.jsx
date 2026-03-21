import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './Toast.module.css';

const Toast = ({ message, type = 'error', onClose, duration = 5000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className={`${styles.toast} ${styles[type]}`} role="alert">
      <span className={styles.message}>{message}</span>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
