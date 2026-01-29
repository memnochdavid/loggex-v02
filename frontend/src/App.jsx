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
