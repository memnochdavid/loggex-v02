import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import ModalView from '../components/ModalView';
import styles from './Login.module.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirigir a la página que intentaba visitar o a /horarios por defecto
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <ModalView
        isOpen={true}
        onClose={() => {}} // No hace nada
        title="Iniciar Sesión"
        showCloseButton={false}
        closeOnOverlayClick={false}
        overlayClassName={styles.loginOverlay}
        className={styles.loginCard}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitText="Entrar"
        cancelText={null} // No mostrar botón cancelar
        footer={
            <Button 
                type="submit" 
                className="w-full" 
                style={{ width: '100%' }}
                disabled={isSubmitting}
                onClick={handleSubmit}
            >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
        }
      >
        {error && <div className={styles.error}>{error}</div>}
        
        <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
                type="email"
                id="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ejemplo@correo.com"
            />
        </div>
        
        <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Contraseña</label>
            <input
                type="password"
                id="password"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
            />
        </div>
      </ModalView>
    </div>
  );
};

export default Login;
