import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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
import Imparticiones from './pages/Imparticiones'; // Importar
import Horarios from './pages/Horarios'; // Importar
import Perfil from './pages/Perfil';
import Configuracion from './pages/Configuracion';
import NotFound from './pages/NotFound';
import PrivateRoute from './components/PrivateRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
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
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
