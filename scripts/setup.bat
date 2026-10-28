@echo off
setlocal EnableDelayedExpansion
pushd "%~dp0\.."

echo === Iniciando configuracion del proyecto Loggex v02 (con Docker, HTTPS Custom Ports y CORS) ===

REM 1. Configuracion del Backend (Symfony)
echo.
echo --- Configurando Backend (Symfony) ---

if not exist "backend\composer.json" (
    echo La carpeta 'backend' parece vacia o no es un proyecto Symfony. Instalando Symfony...
    call composer create-project symfony/skeleton backend

    cd backend
    echo Instalando dependencias (Webapp + CORS)...
    call composer require webapp nelmio/cors-bundle
    cd ..
    echo Backend configurado correctamente.
) else (
    echo La carpeta 'backend' ya contiene un proyecto. Saltando instalacion base.
)

REM Neutralizar archivos compose generados por Symfony
if exist "backend\compose.yaml" (
    echo # Desactivado por setup.bat. Usar docker-compose.yml raiz. > backend\compose.yaml
)
if exist "backend\compose.override.yaml" (
    echo # Desactivado por setup.bat. Usar docker-compose.yml raiz. > backend\compose.override.yaml
)

REM Generar configuracion de Apache (VirtualHost)
(
echo ^<VirtualHost *:80^>
echo     DocumentRoot /var/www/html/public
echo     ^<Directory /var/www/html/public^>
echo         AllowOverride All
echo         Order Allow,Deny
echo         Allow from All
echo     ^</Directory^>
echo ^</VirtualHost^>
) > backend\apache-vhost.conf

REM Generar .htaccess si no existe
if not exist "backend\public\.htaccess" (
    (
    echo DirectoryIndex index.php
    echo ^<IfModule mod_negotiation.c^>
    echo     Options -MultiViews
    echo ^</IfModule^>
    echo ^<IfModule mod_rewrite.c^>
    echo     RewriteEngine On
    echo     RewriteCond %%{REQUEST_URI}::$1 ^^/(.+)/(.*)::\2$
    echo     RewriteRule ^^(.*) - [E=BASE:%%1]
    echo     RewriteCond %%{HTTP:Authorization} .
    echo     RewriteRule ^^ - [E=HTTP_AUTHORIZATION:%%{HTTP:Authorization}]
    echo     RewriteCond %%{ENV:REDIRECT_STATUS} ^^$
    echo     RewriteRule ^^index\.php(?:/(.*)^|$^) %%{ENV:BASE}/$1 [R=301,L]
    echo     RewriteCond %%{REQUEST_FILENAME} -f
    echo     RewriteRule ^^ - [L]
    echo     RewriteRule ^^ %%{ENV:BASE}/index.php [L]
    echo ^</IfModule^>
    echo ^<IfModule !mod_rewrite.c^>
    echo     ^<IfModule mod_alias.c^>
    echo         RedirectMatch 302 ^^/$ /index.php/
    echo     ^</IfModule^>
    echo ^</IfModule^>
    ) > backend\public\.htaccess
)

REM Configurar routes.yaml en modo manual
if not exist "backend\config" mkdir backend\config
(
echo # Configuracion manual de rutas (Fallback)
echo api_hello:
echo     path: /api/hello
echo     controller: App\Controller\ApiController::index
) > backend\config\routes.yaml

REM Generar Dockerfile para Backend (PHP 8.4)
(
echo FROM php:8.4-apache
echo RUN apt-get update ^&^& apt-get install -y \
echo     libpq-dev git unzip \
echo     ^&^& docker-php-ext-install pdo pdo_pgsql
echo RUN a2enmod rewrite
echo COPY apache-vhost.conf /etc/apache2/sites-available/000-default.conf
echo WORKDIR /var/www/html
echo COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
) > backend\Dockerfile


REM 2. Configuracion del Frontend (React + Vite)
echo.
echo --- Configurando Frontend (React + Vite) ---

if not exist "frontend\package.json" (
    echo La carpeta 'frontend' parece vacia. Instalando React con Vite...
    call npm create vite@latest frontend -- --template react

    echo Instalando dependencias de frontend...
    cd frontend
    call npm install
    call npm install react-router-dom

    REM Crear estructura de directorios profesional
    echo Creando estructura de directorios Frontend...
    if not exist "src\components" mkdir src\components
    if not exist "src\layout" mkdir src\layout
    if not exist "src\pages" mkdir src\pages

    REM --- Variables Globales (index.css) ---
    (
    echo :root {
    echo   /* Paleta de Colores (Indigo ^& Slate) */
    echo   --color-primary-50:  #eef2ff;
    echo   --color-primary-100: #e0e7ff;
    echo   --color-primary-200: #c7d2fe;
    echo   --color-primary-300: #a5b4fc;
    echo   --color-primary-400: #818cf8;
    echo   --color-primary-500: #6366f1;
    echo   --color-primary-600: #4f46e5;
    echo   --color-primary-700: #4338ca;
    echo   --color-primary-800: #3730a3;
    echo   --color-primary-900: #312e81;
    echo.
    echo   --color-gray-50:  #f8fafc;
    echo   --color-gray-100: #f1f5f9;
    echo   --color-gray-200: #e2e8f0;
    echo   --color-gray-300: #cbd5e1;
    echo   --color-gray-400: #94a3b8;
    echo   --color-gray-500: #64748b;
    echo   --color-gray-600: #475569;
    echo   --color-gray-700: #334155;
    echo   --color-gray-800: #1e293b;
    echo   --color-gray-900: #0f172a;
    echo.
    echo   --color-success: #10b981;
    echo   --color-warning: #f59e0b;
    echo   --color-error:   #ef4444;
    echo   --color-info:    #3b82f6;
    echo.
    echo   --bg-body:       var(--color-gray-50);
    echo   --bg-card:       #ffffff;
    echo   --bg-dark:       var(--color-gray-800);
    echo.
    echo   --text-main:     var(--color-gray-800);
    echo   --text-muted:    var(--color-gray-500);
    echo   --text-light:    #ffffff;
    echo.
    echo   /* Espaciado (Base 4px) */
    echo   --space-1:  0.25rem;
    echo   --space-2:  0.5rem;
    echo   --space-3:  0.75rem;
    echo   --space-4:  1rem;
    echo   --space-5:  1.25rem;
    echo   --space-6:  1.5rem;
    echo   --space-8:  2rem;
    echo   --space-10: 2.5rem;
    echo   --space-12: 3rem;
    echo   --space-16: 4rem;
    echo.
    echo   /* Tipografia */
    echo   --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
    echo   --text-xs:   0.75rem;
    echo   --text-sm:   0.875rem;
    echo   --text-base: 1rem;
    echo   --text-lg:   1.125rem;
    echo   --text-xl:   1.25rem;
    echo   --text-2xl:  1.5rem;
    echo   --text-3xl:  1.875rem;
    echo.
    echo   --font-normal: 400;
    echo   --font-medium: 500;
    echo   --font-bold:   700;
    echo.
    echo   /* Bordes */
    echo   --radius-sm:  0.25rem;
    echo   --radius-md:  0.375rem;
    echo   --radius-lg:  0.5rem;
    echo   --radius-xl:  0.75rem;
    echo   --radius-full: 9999px;
    echo.
    echo   --border-width: 1px;
    echo   --border-color: var(--color-gray-200);
    echo.
    echo   /* Sombras */
    echo   --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    echo   --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    echo   --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    echo.
    echo   --transition-base: all 0.2s ease-in-out;
    echo }
    echo.
    echo body {
    echo   margin: 0;
    echo   font-family: var(--font-sans);
    echo   background-color: var(--bg-body);
    echo   color: var(--text-main);
    echo   line-height: 1.5;
    echo   -webkit-font-smoothing: antialiased;
    echo }
    echo.
    echo h1, h2, h3, h4, h5, h6 {
    echo   margin: 0;
    echo   font-weight: var(--font-bold);
    echo   color: var(--color-gray-900);
    echo }
    ) > src\index.css

    REM --- Button Component ---
    (
    echo .button {
    echo   display: inline-flex;
    echo   align-items: center;
    echo   justify-content: center;
    echo   padding: var(--space-2) var(--space-4);
    echo   border-radius: var(--radius-md);
    echo   border: 1px solid transparent;
    echo   font-family: inherit;
    echo   font-weight: var(--font-medium);
    echo   font-size: var(--text-base);
    echo   cursor: pointer;
    echo   transition: var(--transition-base);
    echo   box-shadow: var(--shadow-sm);
    echo }
    echo .primary {
    echo   background-color: var(--color-primary-600);
    echo   color: white;
    echo }
    echo .primary:hover {
    echo   background-color: var(--color-primary-700);
    echo   transform: translateY(-1px);
    echo   box-shadow: var(--shadow-md);
    echo }
    echo .primary:active {
    echo   transform: translateY(0);
    echo }
    echo .secondary {
    echo   background-color: transparent;
    echo   border-color: var(--color-gray-300);
    echo   color: var(--text-main);
    echo }
    echo .secondary:hover {
    echo   border-color: var(--color-primary-500);
    echo   color: var(--color-primary-600);
    echo   background-color: var(--color-gray-50);
    echo }
    echo .danger {
    echo   background-color: var(--color-error);
    echo   color: white;
    echo }
    echo .danger:hover {
    echo   background-color: #dc2626;
    echo }
    ) > src\components\Button.module.css

    (
    echo import React from 'react';
    echo import styles from './Button.module.css';
    echo.
    echo const Button = ({ variant = 'primary', children, className, ...props }) =^> {
    echo   const buttonClass = \`\${styles.button} \${styles[variant] ^|^| styles.primary} \${className ^|^| ''}\`.trim();
    echo   return (
    echo     ^<button className={buttonClass} {...props}^>
    echo       {children}
    echo     ^</button^>
    echo   );
    echo };
    echo export default Button;
    ) > src\components\Button.jsx

    REM --- Header ---
    (
    echo .header {
    echo   padding: var(--space-4) var(--space-8);
    echo   background-color: var(--bg-dark);
    echo   color: var(--text-light);
    echo   display: flex;
    echo   align-items: center;
    echo   justify-content: space-between;
    echo   box-shadow: var(--shadow-md);
    echo }
    echo .logoContainer {
    echo   display: flex;
    echo   align-items: center;
    echo   gap: var(--space-3);
    echo }
    echo .logo {
    echo   height: 32px;
    echo }
    echo .title {
    echo   font-weight: var(--font-bold);
    echo   font-size: var(--text-lg);
    echo   letter-spacing: -0.025em;
    echo }
    echo .navLink {
    echo   color: var(--color-gray-300);
    echo   text-decoration: none;
    echo   font-weight: var(--font-medium);
    echo   font-size: var(--text-sm);
    echo   transition: var(--transition-base);
    echo   padding: var(--space-2) var(--space-3);
    echo   border-radius: var(--radius-md);
    echo }
    echo .navLink:hover {
    echo   color: var(--text-light);
    echo   background-color: var(--color-gray-700);
    echo }
    ) > src\layout\Header.module.css

    (
    echo import React from 'react';
    echo import { Link } from 'react-router-dom';
    echo import viteLogo from '/vite.svg';
    echo import styles from './Header.module.css';
    echo.
    echo const Header = () =^> {
    echo   return (
    echo     ^<header className={styles.header}^>
    echo       ^<div className={styles.logoContainer}^>
    echo         ^<img src={viteLogo} alt="Logo" className={styles.logo} /^>
    echo         ^<span className={styles.title}^>Loggex v02^</span^>
    echo       ^</div^>
    echo       ^<nav style={{ display: 'flex', gap: '1rem' }}^>
    echo         ^<Link to="/" className={styles.navLink}^>Home^</Link^>
    echo         ^<Link to="/about" className={styles.navLink}^>About^</Link^>
    echo       ^</nav^>
    echo     ^</header^>
    echo   );
    echo };
    echo export default Header;
    ) > src\layout\Header.jsx

    REM --- Footer ---
    (
    echo .footer {
    echo   padding: var(--space-6);
    echo   background-color: var(--bg-dark);
    echo   color: var(--color-gray-400);
    echo   text-align: center;
    echo   margin-top: auto;
    echo   font-size: var(--text-sm);
    echo   border-top: 1px solid var(--color-gray-700);
    echo }
    ) > src\layout\Footer.module.css

    (
    echo import React from 'react';
    echo import styles from './Footer.module.css';
    echo.
    echo const Footer = () =^> {
    echo   return (
    echo     ^<footer className={styles.footer}^>
    echo       ^<p^>^&copy; {new Date().getFullYear()} Loggex v02 Skeleton. Todos los derechos reservados.^</p^>
    echo     ^</footer^>
    echo   );
    echo };
    echo export default Footer;
    ) > src\layout\Footer.jsx

    REM --- Home ---
    (
    echo .container {
    echo   text-align: center;
    echo   padding: var(--space-12) var(--space-4);
    echo   max-width: 1200px;
    echo   margin: 0 auto;
    echo }
    echo .logo {
    echo   height: 120px;
    echo   margin-bottom: var(--space-6);
    echo   transition: filter 300ms;
    echo }
    echo .logo:hover {
    echo   filter: drop-shadow(0 0 2em rgba(99, 102, 241, 0.5));
    echo }
    echo h1 {
    echo   font-size: var(--text-3xl);
    echo   margin-bottom: var(--space-8);
    echo   color: var(--color-gray-900);
    echo }
    echo .card {
    echo   background-color: var(--bg-card);
    echo   border: 1px solid var(--border-color);
    echo   padding: var(--space-6);
    echo   margin: var(--space-6) auto;
    echo   max-width: 500px;
    echo   border-radius: var(--radius-lg);
    echo   box-shadow: var(--shadow-sm);
    echo   transition: var(--transition-base);
    echo }
    echo .card:hover {
    echo   box-shadow: var(--shadow-md);
    echo   border-color: var(--color-primary-300);
    echo }
    echo .backendStatus {
    echo   font-size: var(--text-lg);
    echo   font-weight: var(--font-medium);
    echo   margin-top: var(--space-2);
    echo }
    echo .statusSuccess {
    echo   color: var(--color-success);
    echo }
    echo .statusError {
    echo   color: var(--color-error);
    echo }
    ) > src\pages\Home.module.css

    (
    echo import React, { useState, useEffect } from 'react';
@REM     echo import reactLogo from '../assets/react.svg';
    echo import styles from './Home.module.css';
    echo import Button from '../components/Button';
    echo.
    echo const Home = () =^> {
    echo   const [count, setCount] = useState(0);
    echo   const [backendMessage, setBackendMessage] = useState('Cargando...');
    echo.
    echo   useEffect(() =^> {
    echo     fetch('https://localhost:9443/api/hello')
    echo       .then(response =^> response.json())
    echo       .then(data =^> setBackendMessage(data.message))
    echo       .catch(error =^> setBackendMessage('Error conectando al backend: ' + error));
    echo   }, []);
    echo.
    echo   const isError = backendMessage.includes('Error');
    echo.
    echo   return (
    echo     ^<div className={styles.container}^>
    echo       ^<div^>
    echo         ^<a href="https://react.dev" target="_blank" rel="noreferrer"^>
    echo           ^<img src={reactLogo} className={styles.logo} alt="React logo" /^>
    echo         ^</a^>
    echo       ^</div^>
    echo       ^<h1^>Bienvenido a Loggex v02^</h1^>
    echo       ^<div className={styles.card}^>
    echo         ^<h2^>Estado del Backend:^</h2^>
    echo         ^<p className={\`\${styles.backendStatus} \${isError ? styles.statusError : styles.statusSuccess}\`}^>
    echo           {backendMessage}
    echo         ^</p^>
    echo       ^</div^>
    echo       ^<div className={styles.card}^>
    echo         ^<Button onClick={() =^> setCount((count) =^> count + 1)}^>
    echo           Contador es {count}
    echo         ^</Button^>
    echo         ^<div style={{ marginTop: '1rem' }}^>
    echo             ^<Button variant="secondary" onClick={() =^> alert('Hola')}^>
    echo                 Botón Secundario
    echo             ^</Button^>
    echo         ^</div^>
    echo       ^</div^>
    echo     ^</div^>
    echo   );
    echo };
    echo export default Home;
    ) > src\pages\Home.jsx

    REM --- About Page ---
    (
    echo import React from 'react';
    echo import styles from './Home.module.css';
    echo.
    echo const About = () =^> {
    echo   return (
    echo     ^<div className={styles.container}^>
    echo       ^<h1^>Acerca de Loggex^</h1^>
    echo       ^<div className={styles.card}^>
    echo         ^<p^>Esta es una aplicación de demostración para mostrar cómo funciona el enrutamiento en React (SPA).^</p^>
    echo         ^<p^>El Header y el Footer se mantienen fijos, ¡solo cambia este contenido!^</p^>
    echo       ^</div^>
    echo     ^</div^>
    echo   );
    echo };
    echo export default About;
    ) > src\pages\About.jsx

    REM --- NotFound Page ---
    (
    echo .container {
    echo   display: flex;
    echo   flex-direction: column;
    echo   align-items: center;
    echo   justify-content: center;
    echo   min-height: 60vh;
    echo   text-align: center;
    echo   padding: var(--space-4);
    echo }
    echo .errorCode {
    echo   font-size: 6rem;
    echo   font-weight: var(--font-bold);
    echo   color: var(--color-primary-500);
    echo   margin: 0;
    echo   line-height: 1;
    echo   text-shadow: 4px 4px 0px var(--color-primary-100);
    echo }
    echo .title {
    echo   font-size: var(--text-2xl);
    echo   color: var(--color-gray-800);
    echo   margin-top: var(--space-4);
    echo   margin-bottom: var(--space-2);
    echo }
    echo .message {
    echo   font-size: var(--text-lg);
    echo   color: var(--color-gray-500);
    echo   margin-bottom: var(--space-8);
    echo   max-width: 500px;
    echo }
    ) > src\pages\NotFound.module.css

    (
    echo import React from 'react';
    echo import { Link } from 'react-router-dom';
    echo import styles from './NotFound.module.css';
    echo import Button from '../components/Button';
    echo.
    echo const NotFound = () =^> {
    echo   return (
    echo     ^<div className={styles.container}^>
    echo       ^<h1 className={styles.errorCode}^>404^</h1^>
    echo       ^<h2 className={styles.title}^>Página no encontrada^</h2^>
    echo       ^<p className={styles.message}^>
    echo         Lo sentimos, la página que estás buscando no existe o ha sido movida.
    echo       ^</p^>
    echo       ^<Link to="/" style={{ textDecoration: 'none' }}^>
    echo         ^<Button^>Volver al Inicio^</Button^>
    echo       ^</Link^>
    echo     ^</div^>
    echo   );
    echo };
    echo export default NotFound;
    ) > src\pages\NotFound.jsx

    REM --- App ---
    (
    echo #root {
    echo   width: 100%%;
    echo   margin: 0;
    echo   padding: 0;
    echo }
    echo .app-layout {
    echo   display: flex;
    echo   flex-direction: column;
    echo   min-height: 100vh;
    echo }
    echo .app-main {
    echo   flex: 1;
    echo }
    ) > src\App.css

    (
    echo import React from 'react';
    echo import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
    echo import Header from './layout/Header';
    echo import Footer from './layout/Footer';
    echo import Home from './pages/Home';
    echo import About from './pages/About';
    echo import NotFound from './pages/NotFound';
    echo import './App.css';
    echo.
    echo function App() {
    echo   return (
    echo     ^<Router^>
    echo       ^<div className="app-layout"^>
    echo         ^<Header /^>
    echo         ^<main className="app-main"^>
    echo           ^<Routes^>
    echo             ^<Route path="/" element={^<Home /^>} /^>
    echo             ^<Route path="/about" element={^<About /^>} /^>
    echo             ^<Route path="*" element={^<NotFound /^>} /^>
    echo           ^</Routes^>
    echo         ^</main^>
    echo         ^<Footer /^>
    echo       ^</div^>
    echo     ^</Router^>
    echo   );
    echo }
    echo export default App;
    ) > src\App.jsx

    cd ..
    echo Frontend configurado correctamente.
) else (
    echo La carpeta 'frontend' ya contiene un proyecto. Saltando instalacion base.
)

REM Generar Dockerfile para Frontend
(
echo FROM node:20-alpine
echo WORKDIR /app
echo COPY package*.json ./
echo RUN npm install
echo COPY . .
echo EXPOSE 5173
echo CMD ["npm", "run", "dev", "--", "--host"]
) > frontend\Dockerfile


REM 3. Generar Caddyfile (HTTPS)
echo.
echo --- Generando Caddyfile (HTTPS) ---
(
echo {
echo     local_certs
echo }
echo localhost {
echo     reverse_proxy frontend:5173
echo }
echo localhost:8443 {
echo     reverse_proxy backend:80
echo }
) > Caddyfile


REM 4. Generar docker-compose.yml
echo.
echo --- Generando docker-compose.yml ---

(
echo version: '3.8'
echo.
echo services:
echo   caddy:
echo     image: caddy:2-alpine
echo     container_name: loggex-caddy
echo     restart: unless-stopped
echo     ports:
echo       - "8888:80"
echo       - "8443:443"
echo       - "9443:8443"
echo     volumes:
echo       - ./Caddyfile:/etc/caddy/Caddyfile:z
echo       - caddy_data:/data:z
echo       - caddy_config:/config:z
echo     depends_on:
echo       - frontend
echo       - backend
echo.
echo   database:
echo     image: postgres:15-alpine
echo     container_name: loggex-db
echo     environment:
echo       POSTGRES_DB: app_db
echo       POSTGRES_USER: app_user
echo       POSTGRES_PASSWORD: app_password
echo     ports:
echo       - "5432:5432"
echo     volumes:
echo       - db_data:/var/lib/postgresql/data:z
echo     security_opt:
echo       - apparmor:unconfined
echo.
echo   backend:
echo     build:
echo       context: ./backend
echo       dockerfile: Dockerfile
echo     container_name: loggex-backend
echo     volumes:
echo       - ./backend:/var/www/html:z
echo     depends_on:
echo       - database
echo     environment:
echo       DATABASE_URL: "postgresql://app_user:app_password@database:5432/app_db?serverVersion=15&charset=utf8"
echo       CORS_ALLOW_ORIGIN: '^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$'
echo     security_opt:
echo       - apparmor:unconfined
echo.
echo   frontend:
echo     build:
echo       context: ./frontend
echo       dockerfile: Dockerfile
echo     container_name: loggex-frontend
echo     volumes:
echo       - ./frontend:/app:z
echo       - /app/node_modules
echo     environment:
echo       - CHOKIDAR_USEPOLLING=true
echo       - HMR_HOST=localhost
echo       - HMR_PORT=8443
echo     depends_on:
echo       - backend
echo     security_opt:
echo       - apparmor:unconfined
echo.
echo volumes:
echo   db_data:
echo   caddy_data:
echo   caddy_config:
) > docker-compose.yml

echo.
echo === Configuracion completada! ===
echo Para iniciar:
echo   docker compose up --build
