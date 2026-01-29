import React, { useEffect, useState } from 'react';
import styles from './Centros.module.css';
import Button from '../components/Button';

const Centros = () => {
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCentros();
  }, []);

  const fetchCentros = async () => {
    try {
      const response = await fetch('https://localhost:9443/api/centros', {
        headers: {
          'Accept': 'application/ld+json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Datos recibidos (raw):", data);

      // Intentar obtener los miembros de varias formas posibles (JSON-LD vs JSON normal)
      const items = data['hydra:member'] || data.member || [];
      
      console.log("Items extraídos:", items);
      setCentros(items);

    } catch (err) {
      console.error("Error fetching centros:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.loadingContainer}>Cargando centros...</div>;
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h3>Error al cargar los centros</h3>
          <p>{error}</p>
          <Button onClick={fetchCentros} style={{ marginTop: '1rem' }}>Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Centros Educativos</h1>
        <Button onClick={fetchCentros}>Recargar</Button>
      </div>

      {centros.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <p>No se encontraron centros.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {centros.map((centro) => (
            <div key={centro.id || centro['@id']} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>{centro.nombre}</h2>
                  <div className={styles.cardSubtitle}>CIF: {centro.cif}</div>
                </div>
                <span className={`${styles.badge} ${centro.activo ? styles.badgeActive : styles.badgeInactive}`}>
                  {centro.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              
              <div className={styles.cardBody}>
                <div className={styles.infoRow}>
                  <span>📍</span> {centro.direccion}
                </div>
                {centro.telefono && (
                  <div className={styles.infoRow}>
                    <span>📞</span> {centro.telefono}
                  </div>
                )}
              </div>

              <Button variant="secondary" style={{ width: '100%', justifyContent: 'center' }}>
                Ver Detalles
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Centros;
