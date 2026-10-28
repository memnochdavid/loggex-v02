import React, { useEffect, useRef } from 'react';
import styles from './ParticlesBackground.module.css';

const PARTICLE_COUNT = 500;

const ParticlesBackground = () => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const particlesRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Leer color primario del tema
        const getColor = () => {
            const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-rgb').trim();
            if (raw) {
                const parts = raw.split(',').map(Number);
                if (parts.length === 3) return parts;
            }
            return [99, 102, 241];
        };

        // Inicializar partículas
        const initParticles = () => {
            particlesRef.current = [];
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particlesRef.current.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    radius: Math.random() * 2 + 1,
                    opacity: Math.random() * 0.5 + 0.1,
                });
            }
        };
        initParticles();

        const CONNECTION_DIST = 150;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const [r, g, b] = getColor();
            const particles = particlesRef.current;

            // Actualizar y dibujar partículas
            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity})`;
                ctx.fill();
            }

            // Dibujar conexiones
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < CONNECTION_DIST) {
                        const alpha = (1 - dist / CONNECTION_DIST) * 0.15;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resize);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return (
        <>
            <div className={styles.gradient} />
            <canvas ref={canvasRef} className={styles.canvas} />
        </>
    );
};

export default ParticlesBackground;
