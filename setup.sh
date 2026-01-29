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

    # Crear estructura de directorios profesional
    echo "Creando estructura de directorios Frontend..."
    mkdir -p src/components src/layout src/pages

    # --- Header ---
    cat <<EOF > src/layout/Header.module.css
.header {
  padding: 1rem;
  background-color: #20232a;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logoContainer {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo {
  height: 30px;
}
.title {
  font-weight: bold;
  font-size: 1.2rem;
}
.navLink {
  color: #61dafb;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}
.navLink:hover {
  color: #ffffff;
}
EOF

    cat <<EOF > src/layout/Header.jsx
import React from 'react';
import viteLogo from '/vite.svg';
import styles from './Header.module.css';

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.logoContainer}>
        <img src={viteLogo} alt="Logo" className={styles.logo} />
        <span className={styles.title}>Loggex v02</span>
      </div>
      <nav>
        <a href="#" className={styles.navLink}>Home</a>
      </nav>
    </header>
  );
};
export default Header;
EOF

    # --- Footer ---
    cat <<EOF > src/layout/Footer.module.css
.footer {
  padding: 1rem;
  background-color: #20232a;
  color: white;
  text-align: center;
  margin-top: auto;
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
  padding: 2rem;
}
.logo {
  height: 100px;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}
.card {
  border: 2px solid #646cff;
  padding: 20px;
  margin: 20px auto;
  max-width: 500px;
  border-radius: 8px;
  background-color: #f9f9f9;
}
.backendStatus {
  font-size: 1.2em;
  font-weight: bold;
}
.statusSuccess {
  color: green;
}
.statusError {
  color: red;
}
.button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
  color: white;
}
.button:hover {
  border-color: #646cff;
}
EOF

    cat <<EOF > src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import reactLogo from '../assets/react.svg';
import styles from './Home.module.css';

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
        <button onClick={() => setCount((count) => count + 1)} className={styles.button}>
          Contador es {count}
        </button>
      </div>
    </div>
  );
};
export default Home;
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
import Header from './layout/Header';
import Footer from './layout/Footer';
import Home from './pages/Home';
import './App.css';

function App() {
  return (
    <div className="app-layout">
      <Header />
      <main className="app-main">
        <Home />
      </main>
      <Footer />
    </div>
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
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
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
      - db_data:/var/lib/postgresql/data
    security_opt:
      - apparmor:unconfined

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: loggex-backend
    volumes:
      - ./backend:/var/www/html
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
      - ./frontend:/app
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
