import React from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  Outlet,
  Navigate,
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
import Itinerarios from './pages/Itinerarios';
import Grupos from './pages/Grupos';
import Materias from './pages/Materias';
import Matriculas from './pages/Matriculas';
import Imparticiones from './pages/Imparticiones';
import Horarios from './pages/Horarios';
import HorariosEditor from './pages/HorariosEditor';
import HorariosAdmin from './pages/HorariosAdmin';
import JornadasAdmin from './pages/JornadasAdmin';
import Excepciones from './pages/Excepciones';
import Fechas from './pages/Fechas';
import Entregas from './pages/Entregas';
import MisFaltas from './pages/MisFaltas';
import Perfil from './pages/Perfil';
import Configuracion from './pages/Configuracion';
import TemariosAlumno from './pages/TemariosAlumno';
import TemariosProfesor from './pages/TemariosProfesor';
import Mensajes from './pages/Mensajes';
import Claustro from './pages/Claustro';
import Companeros from './pages/Companeros';
import MisProfesores from './pages/MisProfesores';
import MisAlumnos from './pages/MisAlumnos'; // Nuevo
import CalificacionesGrupo from './pages/CalificacionesGrupo';
import CalificacionesDetalle from './pages/CalificacionesDetalle';
import MisCalificaciones from './pages/MisCalificaciones';
import CalificacionesAdmin from './pages/CalificacionesAdmin';
import CatalogoAcerca from './pages/catalogo/CatalogoAcerca';
import CatalogoItinerarios from './pages/catalogo/CatalogoItinerarios';
import CatalogoItinerarioDetail from './pages/catalogo/CatalogoItinerarioDetail';
import CatalogoMaterias from './pages/catalogo/CatalogoMaterias';
import CatalogoCentros from './pages/catalogo/CatalogoCentros';
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
                
                {/* SuperAdmin only: gestión de centros del sistema. Bug
                    documentado en mejoras-tecnicas.md §1.3 (admin de centro
                    podía acceder vía URL directa). Backend pendiente de
                    cerrar el agujero per `IsGranted('ROLE_SUPERADMIN')`. */}
                <Route path="/centros" element={
                  <PrivateRoute allowedRoles={['ROLE_SUPERADMIN']}>
                    <Centros />
                  </PrivateRoute>
                } />

                <Route path="/usuarios" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <Usuarios />
                  </PrivateRoute>
                } />

                <Route path="/itinerarios" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <Itinerarios />
                  </PrivateRoute>
                } />

                <Route path="/grupos" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <Grupos />
                  </PrivateRoute>
                } />

                <Route path="/materias" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <Materias />
                  </PrivateRoute>
                } />

                <Route path="/matriculas" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <Matriculas />
                  </PrivateRoute>
                } />

                <Route path="/docencia" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <Imparticiones />
                  </PrivateRoute>
                } />
                {/* Redirect retroactivo: la ruta se renombró 2026-05-12 para
                    alinearla con label/H1. La entidad de BD sigue siendo
                    Imparticion (topics Mercure /imparticiones/{id}/... no se
                    tocan: son strings opacos del hub). */}
                <Route path="/imparticiones" element={<Navigate to="/docencia" replace />} />

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
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <HorariosAdmin />
                  </PrivateRoute>
                } />

                <Route path="/admin/jornadas" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <JornadasAdmin />
                  </PrivateRoute>
                } />

                <Route path="/admin/incidencias" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <Excepciones />
                  </PrivateRoute>
                } />
                {/* Redirect retroactivo: ruta renombrada 2026-05-12 para
                    alinearla con label/H1. Las notificaciones ya emitidas en
                    BD con enlace="/admin/excepciones" llegan aquí. */}
                <Route path="/admin/excepciones" element={<Navigate to="/admin/incidencias" replace />} />

                <Route path="/fechas" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <Fechas />
                  </PrivateRoute>
                } />

                {/* /entregas: profe ve sus tareas+entregas para corregir;
                    alumno ve sus propias tareas+entregas para entregar.
                    Admin no necesita esta vista (admin tiene calificaciones-admin). */}
                <Route path="/entregas" element={
                  <PrivateRoute allowedRoles={['ROLE_PROFESOR', 'ROLE_ALUMNO']}>
                    <Entregas />
                  </PrivateRoute>
                } />

                <Route path="/faltas" element={
                  <PrivateRoute allowedRoles={['ROLE_ALUMNO']}>
                    <MisFaltas />
                  </PrivateRoute>
                } />

                <Route path="/mis-apuntes" element={
                  <PrivateRoute allowedRoles={['ROLE_ALUMNO']}>
                    <TemariosAlumno />
                  </PrivateRoute>
                } />
                {/* Redirect retroactivo: la ruta se renombró 2026-05-12 para
                    alinearla con label/H1. Conserva bookmarks y enlaces vivos. */}
                <Route path="/apuntes" element={<Navigate to="/mis-apuntes" replace />} />

                <Route path="/mis-temarios" element={
                  <PrivateRoute allowedRoles={['ROLE_PROFESOR']}>
                    <TemariosProfesor />
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

                {/* Compañeros: solo alumnos (ven a sus pares de grupo). */}
                <Route path="/companeros" element={
                  <PrivateRoute allowedRoles={['ROLE_ALUMNO']}>
                    <Companeros />
                  </PrivateRoute>
                } />

                <Route path="/mis-profesores" element={
                  <PrivateRoute allowedRoles={['ROLE_ALUMNO']}>
                    <MisProfesores />
                  </PrivateRoute>
                } />

                <Route path="/mis-alumnos" element={
                  <PrivateRoute allowedRoles={['ROLE_PROFESOR']}>
                    <MisAlumnos />
                  </PrivateRoute>
                } />

                <Route path="/perfil" element={
                  <PrivateRoute>
                    <Perfil />
                  </PrivateRoute>
                } />

                <Route path="/personalizacion" element={
                  <PrivateRoute>
                    <Configuracion />
                  </PrivateRoute>
                } />
                {/* Redirect retroactivo: ruta renombrada 2026-05-12 para
                    alinearla con label "Personalización" + H1 ya existente. El
                    componente sigue siendo Configuracion.jsx (detalle interno). */}
                <Route path="/configuracion" element={<Navigate to="/personalizacion" replace />} />

                {/* /calificaciones: vista de profe (sus grupos+tareas para
                    corregir). Alumno tiene su propia /mis-calificaciones.
                    Bug detectado en sesión 2026-05-05 (R2.5). */}
                <Route path="/calificaciones" element={
                  <PrivateRoute allowedRoles={['ROLE_PROFESOR', 'ROLE_ADMIN']}>
                    <CalificacionesGrupo />
                  </PrivateRoute>
                } />

                <Route path="/calificaciones/detalle" element={
                  <PrivateRoute allowedRoles={['ROLE_PROFESOR', 'ROLE_ADMIN']}>
                    <CalificacionesDetalle />
                  </PrivateRoute>
                } />

                <Route path="/mis-calificaciones" element={
                  <PrivateRoute allowedRoles={['ROLE_ALUMNO']}>
                    <MisCalificaciones />
                  </PrivateRoute>
                } />

                <Route path="/admin/estadisticas" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <CalificacionesAdmin />
                  </PrivateRoute>
                } />
                {/* Redirect retroactivo: ruta renombrada 2026-05-12 para
                    alinearla con el label "Estadísticas". El componente y la
                    entidad BD siguen llamándose Calificacion; los topics
                    Mercure /admin/calificaciones permanecen. */}
                <Route path="/admin/calificaciones" element={<Navigate to="/admin/estadisticas" replace />} />

                <Route path="/admin/catalogo/itinerarios" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <CatalogoItinerarios />
                  </PrivateRoute>
                } />

                <Route path="/admin/catalogo/itinerarios/:id" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <CatalogoItinerarioDetail />
                  </PrivateRoute>
                } />

                <Route path="/admin/catalogo/materias" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <CatalogoMaterias />
                  </PrivateRoute>
                } />

                <Route path="/admin/catalogo/centros" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <CatalogoCentros />
                  </PrivateRoute>
                } />

                <Route path="/admin/catalogo/acerca" element={
                  <PrivateRoute allowedRoles={['ROLE_ADMIN']}>
                    <CatalogoAcerca />
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
