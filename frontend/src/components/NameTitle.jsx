import React from 'react';
import { useAuth } from '../context/AuthContext';

const NameTitle = ({ name, className }) => {
    const { user } = useAuth();
    
    // Obtener configuración del centro o usar valores por defecto
    const config = user?.centro?.personalizacion?.nameTitleConfig || {
        words: [], // [{ color: '#000000', text: 'Nombre' }, { color: '#ff0000', text: 'Centro' }]
        spacing: '0.5rem',
        casing: 'original', // 'original', 'uppercase', 'lowercase', 'capitalize'
        alignment: 'center' // 'flex-start', 'center', 'flex-end'
    };

    // Si no hay configuración específica, usar el nombre tal cual
    if (!config.words || config.words.length === 0) {
        // Si no hay nombre, no renderizar nada
        if (!name) return null;

        const words = name.split(' ');
        
        return (
            <div className={className} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                {words.map((word, index) => (
                    <span key={index}>{word}</span>
                ))}
            </div>
        );
    }

    // Aplicar transformación de texto
    const transformText = (text) => {
        switch (config.casing) {
            case 'uppercase': return text.toUpperCase();
            case 'lowercase': return text.toLowerCase();
            case 'capitalize': return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            default: return text;
        }
    };

    return (
        <div className={className} style={{ display: 'flex', gap: config.spacing, alignItems: config.alignment || 'center' }}>
            {config.words.map((wordConfig, index) => (
                <span key={index} style={{ color: wordConfig.color }}>
                    {transformText(wordConfig.text)}
                </span>
            ))}
        </div>
    );
};

export default NameTitle;
