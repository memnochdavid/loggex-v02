import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';
import { useTranslation } from 'react-i18next';
import {
  Mail, Lock, LogIn, Eye, EyeOff, AlertCircle,
  CalendarCheck, Clock, MessageSquare, Users,
  BookOpen, Palette, FileText, Shield
} from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';
import Lottie from 'lottie-react';
import bookAnimation from '../../public/book.json';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    <div className={styles.page}>
      {/* Panel izquierdo - Branding */}
      <div className={styles.brandPanel}>
        <AnimatedBackground forceDefault />

        <div className={styles.brandContent}>
          <div className={styles.lottieContainer}>
            <Lottie animationData={bookAnimation} loop={true} />
          </div>

          <img
            src="/logo_texto_horizontal.png"
            alt="Loggex"
            className={styles.brandLogo}
          />
          <p className={styles.brandTagline}>{t('login.tagline', 'Gestión académica integral')}</p>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <CalendarCheck size={18} className={styles.featureIcon} />
              <span>{t('login.feature1', 'Control de asistencia')}</span>
            </div>
            <div className={styles.featureCard}>
              <Clock size={18} className={styles.featureIcon} />
              <span>{t('login.feature2', 'Gestión de horarios')}</span>
            </div>
            <div className={styles.featureCard}>
              <MessageSquare size={18} className={styles.featureIcon} />
              <span>{t('login.feature3', 'Comunicación integrada')}</span>
            </div>
            <div className={styles.featureCard}>
              <Users size={18} className={styles.featureIcon} />
              <span>{t('login.feature4', 'Gestión de usuarios')}</span>
            </div>
            <div className={styles.featureCard}>
              <FileText size={18} className={styles.featureIcon} />
              <span>{t('login.feature5', 'Tareas y entregas')}</span>
            </div>
            <div className={styles.featureCard}>
              <Palette size={18} className={styles.featureIcon} />
              <span>{t('login.feature6', 'Temas personalizables')}</span>
            </div>
            <div className={styles.featureCard}>
              <BookOpen size={18} className={styles.featureIcon} />
              <span>{t('login.feature7', 'Materiales y temarios')}</span>
            </div>
            <div className={styles.featureCard}>
              <Shield size={18} className={styles.featureIcon} />
              <span>{t('login.feature8', 'Roles y permisos')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className={styles.formPanel}>
        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <img src="/logo_app.png" alt="Loggex" className={styles.formLogo} />
            <h1 className={styles.formTitle}>{t('login.title')}</h1>
            <p className={styles.formSubtitle}>{t('login.subtitle', 'Introduce tus credenciales para acceder')}</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.error}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className={`${styles.inputGroup} ${focusedField === 'email' ? styles.focused : ''} ${email ? styles.filled : ''}`}>
              <label htmlFor="email" className={styles.label}>{t('login.email')}</label>
              <div className={styles.inputWrapper}>
                <Mail size={18} className={styles.inputIcon} />
                <input
                  type="email"
                  id="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required
                  placeholder={t('login.emailPlaceholder')}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={`${styles.inputGroup} ${focusedField === 'password' ? styles.focused : ''} ${password ? styles.filled : ''}`}>
              <label htmlFor="password" className={styles.label}>{t('login.password')}</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className={styles.spinner} />
              ) : (
                <LogIn size={18} />
              )}
              <span>{isSubmitting ? t('login.submitting') : t('login.submit')}</span>
            </button>
          </form>

          <div className={styles.footer}>
            <span className={styles.footerText}>Loggex &copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
