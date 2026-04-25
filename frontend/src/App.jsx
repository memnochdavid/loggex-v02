import React from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { TourProvider } from './context/TourContext';
import Tour from './components/Tour';
import ContextualHelpBadge from './components/ContextualHelpBadge';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Home from './pages/Home';
import About from './pages/About';
import AboutErModel from './pages/AboutErModel';
import Login from './pages/Login';
import Centros from './pages/Centros';
import Usuarios from './pages/Usuarios';
import CiclosFormativos from './pages/CiclosFormativos';
import Grupos from './pages/Grupos';
import Modulos from './pages/Modulos';
import Matriculas from './pages/Matriculas';
import Imparticiones from './pages/Imparticiones';
import Horarios from './pages/Horarios';
import HorariosEditor from './pages/HorariosEditor';
import HorariosAdmin from './pages/HorariosAdmin';
import Fechas from './pages/Fechas';
import Entregas from './pages/Entregas';
import MisFaltas from './pages/MisFaltas';
import Perfil from './pages/Perfil';
import Configuracion from './pages/Configuracion';
import MaterialesAlumno from './pages/MaterialesAlumno';
import MaterialesProfesor from './pages/MaterialesProfesor';
import Mensajes from './pages/Mensajes';
import Claustro from './pages/Claustro';
import Companeros from './pages/Companeros';
import MisProfesores from './pages/MisProfesores';
import MisAlumnos from './pages/MisAlumnos'; // Nuevo
import CalificacionesGrupo from './pages/CalificacionesGrupo';
import CalificacionesDetalle from './pages/CalificacionesDetalle';
import MisCalificaciones from './pages/MisCalificaciones';
import CalificacionesAdmin from './pages/CalificacionesAdmin';
import NotFound from './pages/NotFound';
import PrivateRoute from './components/PrivateRoute';
import AnimatedBackground from './components/AnimatedBackground';
import usePageTitle from './hooks/usePageTitle';
import { Toaster } from 'sonner';
import './App.css';

const PageTitleUpdater = () => {
  usePageTitle('Loggex-Machina');
  return null;
};

const RootLayout = () => {
  const location = useLocation();
  // En /login, /about y /about/* el Footer se renderiza DENTRO del <main>
  // como último hijo, y el main pasa a ser scrollable. El contenido de la
  // página ocupa el alto visible y el Footer queda justo por debajo del
  // viewport — sólo aparece al hacer scroll hacia abajo.
  const showFooter = location.pathname === '/login'
    || location.pathname === '/about'
    || location.pathname.startsWith('/about/');

  return (
    <>
      <PageTitleUpdater />
      {/* TourProvider va dentro del Router (RootLayout es el elemento raíz
          de las rutas) para poder usar useLocation y reaccionar al login. */}
      <TourProvider>
        <div className="app-layout">
          <AnimatedBackground />
          <Header />
          <main className={`app-main${showFooter ? ' app-main--withFooter' : ''}`}>
            <Outlet />
            {showFooter && <Footer />}
          </main>
          {/* Tour se monta una vez en el root y se activa solo cuando
              TourContext.currentTour deja de ser null. */}
          <Tour />
          {/* Badge flotante que ofrece el tour asociado a la ruta actual
              (Fase 3 — ayuda contextual). Oculto si no hay candidato. */}
          <ContextualHelpBadge />
        </div>
      </TourProvider>
    </>
  );
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
                <Route path="/login" element={<Login />} />
                
                {/* Rutas Públicas */}
                <Route path="/about" element={<About />} />
                <Route path="/about/er" element={<AboutErModel />} />
                
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

                <Route path="/horarios/editor" element={
                  <PrivateRoute>
                    <HorariosEditor />
                  </PrivateRoute>
                } />

                <Route path="/admin/horarios" element={
                  <PrivateRoute>
                    <HorariosAdmin />
                  </PrivateRoute>
                } />

                <Route path="/fechas" element={
                  <PrivateRoute>
                    <Fechas />
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

                <Route path="/calificaciones" element={
                  <PrivateRoute>
                    <CalificacionesGrupo />
                  </PrivateRoute>
                } />

                <Route path="/calificaciones/detalle" element={
                  <PrivateRoute>
                    <CalificacionesDetalle />
                  </PrivateRoute>
                } />

                <Route path="/mis-calificaciones" element={
                  <PrivateRoute>
                    <MisCalificaciones />
                  </PrivateRoute>
                } />

                <Route path="/admin/calificaciones" element={
                  <PrivateRoute>
                    <CalificacionesAdmin />
                  </PrivateRoute>
                } />

                <Route path="*" element={<NotFound />} />
    </Route>
  )
);

function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            expand={false}
            toastOptions={{ duration: 4000 }}
          />
        </ConfirmProvider>
      </UIProvider>
    </AuthProvider>
  );
}

export default App;
