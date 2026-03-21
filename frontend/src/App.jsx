import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Login from './pages/Login';
import PrivateRoute from './components/PrivateRoute';
import AnimatedBackground from './components/AnimatedBackground';
import LoadingView from './components/LoadingView';
import usePageTitle from './hooks/usePageTitle';
import './App.css';

// Lazy-loaded pages
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Centros = lazy(() => import('./pages/Centros'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const CiclosFormativos = lazy(() => import('./pages/CiclosFormativos'));
const Grupos = lazy(() => import('./pages/Grupos'));
const Modulos = lazy(() => import('./pages/Modulos'));
const Matriculas = lazy(() => import('./pages/Matriculas'));
const Imparticiones = lazy(() => import('./pages/Imparticiones'));
const Horarios = lazy(() => import('./pages/Horarios'));
const Festivos = lazy(() => import('./pages/Festivos'));
const Tareas = lazy(() => import('./pages/Tareas'));
const Entregas = lazy(() => import('./pages/Entregas'));
const MisFaltas = lazy(() => import('./pages/MisFaltas'));
const Perfil = lazy(() => import('./pages/Perfil'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const MaterialesAlumno = lazy(() => import('./pages/MaterialesAlumno'));
const MaterialesProfesor = lazy(() => import('./pages/MaterialesProfesor'));
const Mensajes = lazy(() => import('./pages/Mensajes'));
const Claustro = lazy(() => import('./pages/Claustro'));
const Companeros = lazy(() => import('./pages/Companeros'));
const MisProfesores = lazy(() => import('./pages/MisProfesores'));
const MisAlumnos = lazy(() => import('./pages/MisAlumnos'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageTitleUpdater = () => {
  usePageTitle('Loggex-Machina');
  return null;
};

// Componente auxiliar para renderizar el Footer condicionalmente
const ConditionalFooter = () => {
  const location = useLocation();
  // Mostrar footer solo en Login y About
  const showFooter = ['/login', '/about'].includes(location.pathname);

  return showFooter ? <Footer /> : null;
};

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <UIProvider>
        <ToastProvider>
        <Router>
          <PageTitleUpdater />
          <div className="app-layout">
            <AnimatedBackground />
            <Header />
            <main className="app-main" role="main">
              <Suspense fallback={<LoadingView />}>
              <Routes>
                <Route path="/login" element={<Login />} />

                {/* Rutas Públicas */}
                <Route path="/about" element={<About />} />

                {/* Rutas Protegidas */}
                <Route path="/" element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                } />

                <Route path="/centros" element={
                  <PrivateRoute>
                    <Centros />
                  </PrivateRoute>
                } />

                <Route path="/usuarios" element={
                  <PrivateRoute>
                    <Usuarios />
                  </PrivateRoute>
                } />

                <Route path="/ciclos" element={
                  <PrivateRoute>
                    <CiclosFormativos />
                  </PrivateRoute>
                } />

                <Route path="/grupos" element={
                  <PrivateRoute>
                    <Grupos />
                  </PrivateRoute>
                } />

                <Route path="/modulos" element={
                  <PrivateRoute>
                    <Modulos />
                  </PrivateRoute>
                } />

                <Route path="/matriculas" element={
                  <PrivateRoute>
                    <Matriculas />
                  </PrivateRoute>
                } />

                <Route path="/imparticiones" element={
                  <PrivateRoute>
                    <Imparticiones />
                  </PrivateRoute>
                } />

                <Route path="/horarios" element={
                  <PrivateRoute>
                    <Horarios />
                  </PrivateRoute>
                } />

                <Route path="/festivos" element={
                  <PrivateRoute>
                    <Festivos />
                  </PrivateRoute>
                } />

                <Route path="/tareas" element={
                  <PrivateRoute>
                    <Tareas />
                  </PrivateRoute>
                } />

                <Route path="/entregas" element={
                  <PrivateRoute>
                    <Entregas />
                  </PrivateRoute>
                } />

                <Route path="/faltas" element={
                  <PrivateRoute>
                    <MisFaltas />
                  </PrivateRoute>
                } />

                <Route path="/apuntes" element={
                  <PrivateRoute>
                    <MaterialesAlumno />
                  </PrivateRoute>
                } />

                <Route path="/mis-temarios" element={
                  <PrivateRoute>
                    <MaterialesProfesor />
                  </PrivateRoute>
                } />

                <Route path="/mensajes" element={
                  <PrivateRoute>
                    <Mensajes />
                  </PrivateRoute>
                } />

                <Route path="/claustro" element={
                  <PrivateRoute>
                    <Claustro />
                  </PrivateRoute>
                } />

                <Route path="/companeros" element={
                  <PrivateRoute>
                    <Companeros />
                  </PrivateRoute>
                } />

                <Route path="/mis-profesores" element={
                  <PrivateRoute>
                    <MisProfesores />
                  </PrivateRoute>
                } />

                <Route path="/mis-alumnos" element={
                  <PrivateRoute>
                    <MisAlumnos />
                  </PrivateRoute>
                } />

                <Route path="/perfil" element={
                  <PrivateRoute>
                    <Perfil />
                  </PrivateRoute>
                } />

                <Route path="/configuracion" element={
                  <PrivateRoute>
                    <Configuracion />
                  </PrivateRoute>
                } />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </main>
            <ConditionalFooter />
          </div>
        </Router>
        </ToastProvider>
      </UIProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
