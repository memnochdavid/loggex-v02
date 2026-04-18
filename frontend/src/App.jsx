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
import './App.css';

const PageTitleUpdater = () => {
  usePageTitle('Loggex-Machina');
  return null;
};

// Componente auxiliar para renderizar el Footer condicionalmente
const ConditionalFooter = () => {
  const location = useLocation();
  // Mostrar footer en Login y en cualquier subruta de /about
  const showFooter = location.pathname === '/login'
    || location.pathname === '/about'
    || location.pathname.startsWith('/about/');
  
  return showFooter ? <Footer /> : null;
};

const RootLayout = () => (
  <>
    <PageTitleUpdater />
    <div className="app-layout">
      <AnimatedBackground />
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
      <ConditionalFooter />
    </div>
  </>
);

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
        <RouterProvider router={router} />
      </UIProvider>
    </AuthProvider>
  );
}

export default App;
