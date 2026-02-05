import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import Centros from './pages/Centros';
import Usuarios from './pages/Usuarios';
import CiclosFormativos from './pages/CiclosFormativos';
import Grupos from './pages/Grupos';
import Modulos from './pages/Modulos';
import Matriculas from './pages/Matriculas';
import Imparticiones from './pages/Imparticiones';
import Horarios from './pages/Horarios';
import Festivos from './pages/Festivos';
import Tareas from './pages/Tareas';
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
import NotFound from './pages/NotFound';
import PrivateRoute from './components/PrivateRoute';
import usePageTitle from './hooks/usePageTitle';
import './App.css';

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
    <AuthProvider>
      <UIProvider>
        <Router>
          <PageTitleUpdater />
          <div className="app-layout">
            <Header />
            <main className="app-main">
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
            </main>
            <ConditionalFooter />
          </div>
        </Router>
      </UIProvider>
    </AuthProvider>
  );
}

export default App;
