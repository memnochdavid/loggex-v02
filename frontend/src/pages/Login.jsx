import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';
import { useTranslation } from 'react-i18next';
import {
  Mail, Lock, LogIn, Eye, EyeOff, AlertCircle,
  ArrowRight, CornerDownLeft, Sparkles,
} from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [capsLock, setCapsLock] = useState(false);
  const cardRef = useRef(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  // Parallax sutil: el ratón mueve ligeramente el glow del card.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const handle = (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--px', `${x}%`);
      el.style.setProperty('--py', `${y}%`);
    };
    el.addEventListener('mousemove', handle);
    return () => el.removeEventListener('mousemove', handle);
  }, []);

  const handleKeyUp = (e) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  };

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
      {/* Fondo de ondas global */}
      <div className={styles.pageBg} aria-hidden="true">
        <AnimatedBackground type="waves" />
      </div>

      <section className={styles.formPanel}>
        <div className={styles.stack}>
          {/* ============ CARD DEL FORMULARIO ============ */}
          <div ref={cardRef} className={styles.formCard}>
            <div className={styles.formCardGlow} aria-hidden="true" />

            <div className={styles.formHeader}>
              <div className={styles.formLogoWrap}>
                <img src="/logo_app.png" alt="Loggex" className={styles.formLogo} />
              </div>
              <h1 className={styles.formTitle}>{t('login.title')}</h1>
              <p className={styles.formSubtitle}>
                {t('login.subtitle', 'Introduce tus credenciales para acceder')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              {error && (
                <div className={styles.error} role="alert">
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
                  <span className={styles.inputUnderline} aria-hidden="true" />
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
                    onKeyUp={handleKeyUp}
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
                  <span className={styles.inputUnderline} aria-hidden="true" />
                </div>
                {capsLock && (
                  <span className={styles.capsHint}>
                    <AlertCircle size={12} /> {t('login.capsLock', 'Bloq Mayús activado')}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSubmitting}
              >
                <span className={styles.submitSheen} aria-hidden="true" />
                <span className={styles.submitContent}>
                  {isSubmitting ? (
                    <span className={styles.spinner} />
                  ) : (
                    <LogIn size={18} />
                  )}
                  <span>{isSubmitting ? t('login.submitting') : t('login.submit')}</span>
                </span>
                <span className={styles.submitShortcut} aria-hidden="true">
                  <CornerDownLeft size={12} />
                </span>
              </button>
            </form>
          </div>

          {/* Enlace a /about — acción secundaria, fuera del card para no
              competir con el botón de submit. */}
          <Link to="/about" className={styles.learnMore}>
            <Sparkles size={13} />
            <span>{t('login.learnMore', 'Conoce Loggex')}</span>
            <ArrowRight size={14} className={styles.learnMoreArrow} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Login;
