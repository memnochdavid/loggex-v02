import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Hook para gestionar la paginación con valores por defecto personalizados
 * @param {string} viewName - Nombre de la vista (usuarios, centros, ciclos, grupos, modulos, matriculas, imparticiones, horarios)
 * @param {number} defaultFallback - Valor por defecto si no hay configuración (20)
 */
export const usePagination = (viewName, defaultFallback = 20) => {
    const { user } = useAuth();
    
    // Obtener configuración del usuario
    const getPersonalizedItemsPerPage = () => {
        if (!user) return defaultFallback;
        
        let personalizacion = null;
        
        if (user.centro && user.centro.personalizacion) {
            personalizacion = user.centro.personalizacion;
        } else if (user.centro && user.centro.id === 'global' && user.centro.personalizacion) {
             // Caso SuperAdmin con centro global ficticio
             personalizacion = user.centro.personalizacion;
        }

        if (personalizacion) {
            // Mapear nombre de vista a propiedad de personalización
            const key = `itemsPerPage${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`;
            if (personalizacion[key]) {
                return personalizacion[key];
            }
        }
        
        return defaultFallback;
    };

    const [itemsPerPage, setItemsPerPage] = useState(getPersonalizedItemsPerPage());

    // Actualizar si cambia el usuario o su configuración (ej: al guardar en Configuración)
    useEffect(() => {
        setItemsPerPage(getPersonalizedItemsPerPage());
    }, [user]);

    return [itemsPerPage, setItemsPerPage];
};
