#!/bin/bash

# Detener el script si hay errores
set -e

echo "=== Iniciando configuración del proyecto Loggex v02 (con Docker, HTTPS Custom Ports y CORS) ==="

# 1. Configuración del Backend (Symfony)
echo ""
echo "--- Configurando Backend (Symfony) ---"

if [ -z "$(ls -A backend)" ]; then
    echo "La carpeta 'backend' está vacía. Instalando Symfony..."
    composer create-project symfony/skeleton backend

    cd backend
    echo "Instalando dependencias (Webapp + CORS)..."
    composer require webapp nelmio/cors-bundle
    cd ..
    echo "Backend configurado correctamente."
else
    echo "La carpeta 'backend' no está vacía. Saltando instalación base."
fi

# Neutralizar archivos compose generados por Symfony
if [ -f backend/compose.yaml ]; then
    echo "# Desactivado por setup.sh. Usar docker-compose.yml raíz." > backend/compose.yaml
fi
if [ -f backend/compose.override.yaml ]; then
    echo "# Desactivado por setup.sh. Usar docker-compose.yml raíz." > backend/compose.override.yaml
fi

# Generar configuración de Apache (VirtualHost)
cat <<EOF > backend/apache-vhost.conf
<VirtualHost *:80>
    DocumentRoot /var/www/html/public
    <Directory /var/www/html/public>
        AllowOverride All
        Order Allow,Deny
        Allow from All
    </Directory>
</VirtualHost>
EOF

# Generar .htaccess si no existe
if [ ! -f backend/public/.htaccess ]; then
    cat <<EOF > backend/public/.htaccess
DirectoryIndex index.php
<IfModule mod_negotiation.c>
    Options -MultiViews
</IfModule>
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_URI}::$1 ^(/.+)/(.*)::\2$
    RewriteRule ^(.*) - [E=BASE:%1]
    RewriteCond %{HTTP:Authorization} .
    RewriteRule ^ - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
    RewriteCond %{ENV:REDIRECT_STATUS} ^$
    RewriteRule ^index\.php(?:/(.*)|$) %{ENV:BASE}/$1 [R=301,L]
    RewriteCond %{REQUEST_FILENAME} -f
    RewriteRule ^ - [L]
    RewriteRule ^ %{ENV:BASE}/index.php [L]
</IfModule>
<IfModule !mod_rewrite.c>
    <IfModule mod_alias.c>
        RedirectMatch 302 ^/$ /index.php/
    </IfModule>
</IfModule>
EOF
fi

# Configurar routes.yaml en modo manual
cat <<EOF > backend/config/routes.yaml
# Configuración manual de rutas (Fallback)
api_hello:
    path: /api/hello
    controller: App\Controller\ApiController::index
EOF

# Generar Dockerfile para Backend (PHP 8.4)
cat <<EOF > backend/Dockerfile
FROM php:8.4-apache
RUN apt-get update && apt-get install -y \\
    libpq-dev git unzip \\
    && docker-php-ext-install pdo pdo_pgsql
RUN a2enmod rewrite
COPY apache-vhost.conf /etc/apache2/sites-available/000-default.conf
WORKDIR /var/www/html
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
EOF


# 2. Configuración del Frontend (React + Vite)
echo ""
echo "--- Configurando Frontend (React + Vite) ---"

if [ -z "$(ls -A frontend)" ]; then
    echo "La carpeta 'frontend' está vacía. Instalando React con Vite..."
    npm create vite@latest frontend -- --template react

    echo "Instalando dependencias de frontend..."
    cd frontend
    npm install
    npm install react-router-dom

    # Crear estructura de directorios profesional
    echo "Creando estructura de directorios Frontend..."
    mkdir -p src/components src/layout src/pages

    # --- Variables Globales (index.css) ---
    cat <<EOF > src/index.css
:root {
  /* Paleta de Colores (Indigo & Slate) */
  --color-primary-50:  #eef2ff;
  --color-primary-100: #e0e7ff;
  --color-primary-200: #c7d2fe;
  --color-primary-300: #a5b4fc;
  --color-primary-400: #818cf8;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;
  --color-primary-700: #4338ca;
  --color-primary-800: #3730a3;
  --color-primary-900: #312e81;

  --color-gray-50:  #f8fafc;
  --color-gray-100: #f1f5f9;
  --color-gray-200: #e2e8f0;
  --color-gray-300: #cbd5e1;
  --color-gray-400: #94a3b8;
  --color-gray-500: #64748b;
  --color-gray-600: #475569;
  --color-gray-700: #334155;
  --color-gray-800: #1e293b;
  --color-gray-900: #0f172a;

  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error:   #ef4444;
  --color-info:    #3b82f6;

  --bg-body:       var(--color-gray-5);
  --bg-card:       #ffffff;
  --bg-dark:       var(--color-gray-800);

  --text-main:     var(--color-gray-800);
  --text-muted:    var(--color-gray-500);
  --text-light:    #ffffff;

  /* Espaciado (Base 4px) */
  --space-1:  0.25rem;
  --space-2:  0.5rem;
  --space-3:  0.75rem;
  --space-4:  1rem;
  --space-5:  1.25rem;
  --space-6:  1.5rem;
  --space-8:  2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Tipografía */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --text-3xl:  1.875rem;

  --font-normal: 400;
  --font-medium: 500;
  --font-bold:   700;

  /* Bordes */
  --radius-sm:  0.25rem;
  --radius-md:  0.375rem;
  --radius-lg:  0.5rem;
  --radius-xl:  0.75rem;
  --radius-full: 9999px;

  --border-width: 1px;
  --border-color: var(--color-gray-200);

  /* Sombras */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

  --transition-base: all 0.2s ease-in-out;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background-color: var(--bg-body);
  color: var(--text-main);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  margin: 0;
  font-weight: var(--font-bold);
  color: var(--color-gray-900);
}
EOF

    # --- Button Component ---
    cat <<EOF > src/components/Button.module.css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  font-family: inherit;
  font-weight: var(--font-medium);
  font-size: var(--text-base);
  cursor: pointer;
  transition: var(--transition-base);
  box-shadow: var(--shadow-sm);
}
.primary {
  background-color: var(--color-primary-600);
  color: white;
}
.primary:hover {
  background-color: var(--color-primary-700);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
.primary:active {
  transform: translateY(0);
}
.secondary {
  background-color: transparent;
  border-color: var(--color-gray-300);
  color: var(--text-main);
}
.secondary:hover {
  border-color: var(--color-primary-500);
  color: var(--color-primary-600);
  background-color: var(--color-gray-50);
}
.danger {
  background-color: var(--color-error);
  color: white;
}
.danger:hover {
  background-color: #dc2626;
}
EOF

    cat <<EOF > src/components/Button.jsx
import React from 'react';
import styles from './Button.module.css';

const Button = ({ variant = 'primary', children, className, ...props }) => {
  const buttonClass = \`\${styles.button} \${styles[variant] || styles.primary} \${className || ''}\`.trim();
  return (
    <button className={buttonClass} {...props}>
      {children}
    </button>
  );
};
export default Button;
EOF

    # --- Header ---
    cat <<EOF > src/layout/Header.module.css
.header {
  padding: var(--space-4) var(--space-8);
  background-color: var(--bg-dark);
  color: var(--text-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-md);
}
.logoContainer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.logo {
  height: 32px;
}
.title {
  font-weight: var(--font-bold);
  font-size: var(--text-lg);
  letter-spacing: -0.025em;
}
.navLink {
  color: var(--color-gray-300);
  text-decoration: none;
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  transition: var(--transition-base);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
}
.navLink:hover {
  color: var(--text-light);
  background-color: var(--color-gray-700);
}
EOF

    cat <<EOF > src/layout/Header.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import viteLogo from '/vite.svg';
import styles from './Header.module.css';

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.logoContainer}>
        <img src={viteLogo} alt="Logo" className={styles.logo} />
        <span className={styles.title}>Loggex v02</span>
      </div>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/" className={styles.navLink}>Home</Link>
        <Link to="/about" className={styles.navLink}>About</Link>
      </nav>
    </header>
  );
};
export default Header;
EOF

    # --- Footer ---
    cat <<EOF > src/layout/Footer.module.css
.footer {
  padding: var(--space-6);
  background-color: var(--bg-dark);
  color: var(--color-gray-400);
  text-align: center;
  margin-top: auto;
  font-size: var(--text-sm);
  border-top: 1px solid var(--color-gray-700);
}
EOF

    cat <<EOF > src/layout/Footer.jsx
import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <p>&copy; {new Date().getFullYear()} Loggex v02 Skeleton. Todos los derechos reservados.</p>
    </footer>
  );
};
export default Footer;
EOF

    # --- Home ---
    cat <<EOF > src/pages/Home.module.css
.container {
  text-align: center;
  padding: var(--space-12) var(--space-4);
  max-width: 1200px;
  margin: 0 auto;
}
.logo {
  height: 120px;
  margin-bottom: var(--space-6);
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em rgba(99, 102, 241, 0.5));
}
h1 {
  font-size: var(--text-3xl);
  margin-bottom: var(--space-8);
  color: var(--color-gray-900);
}
.card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: var(--space-6);
  margin: var(--space-6) auto;
  max-width: 500px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: var(--transition-base);
}
.card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-300);
}
.backendStatus {
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  margin-top: var(--space-2);
}
.statusSuccess {
  color: var(--color-success);
}
.statusError {
  color: var(--color-error);
}
EOF

    cat <<EOF > src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import reactLogo from '../assets/react.svg';
import styles from './Home.module.css';
import Button from '../components/Button';

const Home = () => {
  const [count, setCount] = useState(0);
  const [backendMessage, setBackendMessage] = useState('Cargando...');

  useEffect(() => {
    fetch('https://localhost:9443/api/hello')
      .then(response => response.json())
      .then(data => setBackendMessage(data.message))
      .catch(error => setBackendMessage('Error conectando al backend: ' + error));
  }, []);

  const isError = backendMessage.includes('Error');

  return (
    <div className={styles.container}>
      <div>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className={styles.logo} alt="React logo" />
        </a>
      </div>
      <h1>Bienvenido a Loggex v02</h1>
      <div className={styles.card}>
        <h2>Estado del Backend:</h2>
        <p className={\`\${styles.backendStatus} \${isError ? styles.statusError : styles.statusSuccess}\`}>
          {backendMessage}
        </p>
      </div>
      <div className={styles.card}>
        <Button onClick={() => setCount((count) => count + 1)}>
          Contador es {count}
        </Button>
        <div style={{ marginTop: '1rem' }}>
            <Button variant="secondary" onClick={() => alert('Hola')}>
                Botón Secundario
            </Button>
        </div>
      </div>
    </div>
  );
};
export default Home;
EOF

    # --- About Page ---
    cat <<EOF > src/pages/About.jsx
import React from 'react';
import styles from './Home.module.css';

const About = () => {
  return (
    <div className={styles.container}>
      <h1>Acerca de Loggex</h1>
      <div className={styles.card}>
        <p>Esta es una aplicación de demostración para mostrar cómo funciona el enrutamiento en React (SPA).</p>
        <p>El Header y el Footer se mantienen fijos, ¡solo cambia este contenido!</p>
      </div>
    </div>
  );
};
export default About;
EOF

    # --- NotFound Page ---
    cat <<EOF > src/pages/NotFound.module.css
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: var(--space-4);
}
.errorCode {
  font-size: 6rem;
  font-weight: var(--font-bold);
  color: var(--color-primary-500);
  margin: 0;
  line-height: 1;
  text-shadow: 4px 4px 0px var(--color-primary-100);
}
.title {
  font-size: var(--text-2xl);
  color: var(--color-gray-800);
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
}
.message {
  font-size: var(--text-lg);
  color: var(--color-gray-500);
  margin-bottom: var(--space-8);
  max-width: 500px;
}
EOF

    cat <<EOF > src/pages/NotFound.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './NotFound.module.css';
import Button from '../components/Button';

const NotFound = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.errorCode}>404</h1>
      <h2 className={styles.title}>Página no encontrada</h2>
      <p className={styles.message}>
        Lo sentimos, la página que estás buscando no existe o ha sido movida.
      </p>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Button>Volver al Inicio</Button>
      </Link>
    </div>
  );
};
export default NotFound;
EOF

    # --- App ---
    cat <<EOF > src/App.css
#root {
  width: 100%;
  margin: 0;
  padding: 0;
}
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-main {
  flex: 1;
}
EOF

    cat <<EOF > src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Home from './pages/Home';
import About from './pages/About';
import NotFound from './pages/NotFound';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}
export default App;
EOF

    cd ..
    echo "Frontend configurado correctamente."
else
    echo "La carpeta 'frontend' no está vacía. Saltando instalación base."
fi

# Generar Dockerfile para Frontend
cat <<EOF > frontend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
EOF


# 3. Generar Caddyfile (HTTPS)
echo ""
echo "--- Generando Caddyfile (HTTPS) ---"
cat <<EOF > Caddyfile
{
    local_certs
}
localhost {
    reverse_proxy frontend:5173
}
localhost:8443 {
    reverse_proxy backend:80
}
EOF


# 4. Generar docker-compose.yml
echo ""
echo "--- Generando docker-compose.yml ---"

cat <<EOF > docker-compose.yml
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    container_name: loggex-caddy
    restart: unless-stopped
    ports:
      - "8888:80"
      - "8443:443"
      - "9443:8443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:z
      - caddy_data:/data:z
      - caddy_config:/config:z
    depends_on:
      - frontend
      - backend

  database:
    image: postgres:15-alpine
    container_name: loggex-db
    environment:
      POSTGRES_DB: app_db
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: app_password
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data:z
    security_opt:
      - apparmor:unconfined

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: loggex-backend
    volumes:
      - ./backend:/var/www/html:z
    depends_on:
      - database
    environment:
      DATABASE_URL: "postgresql://app_user:app_password@database:5432/app_db?serverVersion=15&charset=utf8"
      CORS_ALLOW_ORIGIN: '^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$'
    security_opt:
      - apparmor:unconfined

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: loggex-frontend
    volumes:
      - ./frontend:/app:z
      - /app/node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true
      - HMR_HOST=localhost
      - HMR_PORT=8443
    depends_on:
      - backend
    security_opt:
      - apparmor:unconfined

volumes:
  db_data:
  caddy_data:
  caddy_config:
EOF

echo ""
echo "=== ¡Configuración completada! ==="
echo "Para iniciar:"
echo "  docker compose up --build"
