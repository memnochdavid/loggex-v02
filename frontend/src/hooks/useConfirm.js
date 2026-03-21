import { useState, useCallback } from 'react';

const useConfirm = () => {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    resolve: null,
  });

  const confirm = useCallback((message, title = '') => {
    return new Promise((resolve) => {
      setState({ isOpen: true, title, message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState({ isOpen: false, title: '', message: '', resolve: null });
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState({ isOpen: false, title: '', message: '', resolve: null });
  }, [state.resolve]);

  return {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    confirm,
    handleConfirm,
    handleCancel,
  };
};

export default useConfirm;
