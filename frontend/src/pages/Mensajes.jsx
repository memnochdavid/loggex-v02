import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../context/AuthContext';
import styles from './Mensajes.module.css';
import { Send, User, ArrowLeft } from 'lucide-react';
import Button from '../components/Button';
import { getApiUrl, getAssetUrl, POLLING_INTERVAL_CHAT } from '../config/api';

const Mensajes = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [conversaciones, setConversaciones] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [mensajesChat, setMensajesChat] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const navigationProcessed = useRef(false);
    const prevMensajesLength = useRef(0);
    const isUserNearBottom = useRef(true);

    useEffect(() => {
        if (user) {
            fetchMensajes();
            const interval = setInterval(fetchMensajes, POLLING_INTERVAL_CHAT);
            return () => clearInterval(interval);
        }
    }, [user]);

    // Manejar scroll manual para detectar si el usuario subió
    const handleScroll = () => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            // Consideramos "cerca del fondo" si está a menos de 100px
            isUserNearBottom.current = scrollHeight - scrollTop - clientHeight < 100;
        }
    };

    // Efecto para navegación inicial
    useEffect(() => {
        if (location.state?.chatWith && !loading && !navigationProcessed.current) {
            const targetUser = location.state.chatWith;
            const existingChat = conversaciones.find(c => c.usuario.id === targetUser.id);
            
            navigationProcessed.current = true;

            if (existingChat) {
                handleSelectUser(existingChat.usuario);
            } else {
                const newChat = {
                    usuario: targetUser,
                    mensajes: [],
                    ultimoMensaje: { fechaEnvio: new Date(), texto: 'Nueva conversación' },
                    noLeidos: 0,
                    isTemp: true
                };
                setConversaciones(prev => [newChat, ...prev]);
                handleSelectUser(targetUser);
            }
            window.history.replaceState({}, document.title);
        }
    }, [location.state, loading, conversaciones]);

    // Actualizar mensajes del chat activo cuando llegan nuevos datos
    useEffect(() => {
        if (selectedUser) {
            const chat = conversaciones.find(c => c.usuario.id === selectedUser.id);
            if (chat) {
                // Solo actualizar si hay cambios reales para evitar re-renders innecesarios
                // (Aunque React suele ser inteligente, aquí forzamos la actualización del estado)
                setMensajesChat(chat.mensajes);
            } else {
                setMensajesChat([]);
            }
        }
    }, [conversaciones, selectedUser]);

    // Control de Scroll Inteligente
    useLayoutEffect(() => {
        // Caso 1: Cambio de usuario -> Scroll al fondo siempre
        if (prevMensajesLength.current === 0 && mensajesChat.length > 0) {
            scrollToBottom();
            isUserNearBottom.current = true;
        } 
        // Caso 2: Nuevos mensajes llegaron
        else if (mensajesChat.length > prevMensajesLength.current) {
            const lastMessage = mensajesChat[0]; // El array está invertido en render ([...].reverse()), pero aquí el último es el 0 o el último según cómo venga de API
            // La API devuelve lista, agruparConversaciones hace push.
            // En render hacemos [...mensajesChat].reverse().
            // Significa que mensajesChat[mensajesChat.length - 1] es el más reciente.
            
            const realLastMessage = mensajesChat[mensajesChat.length - 1];
            const isMyMessage = realLastMessage?.remitente?.id === user.id;

            if (isMyMessage || isUserNearBottom.current) {
                scrollToBottom();
            }
        }

        prevMensajesLength.current = mensajesChat.length;
    }, [mensajesChat, selectedUser]);

    // Resetear ref al cambiar de usuario
    useEffect(() => {
        prevMensajesLength.current = 0;
        isUserNearBottom.current = true;
        scrollToBottom();
    }, [selectedUser]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" }); // Auto es más instantáneo que smooth para cargas
    };

    const fetchMensajes = async () => {
        try {
            const response = await fetch(getApiUrl('/api/v1/mensajes'), {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                const allMessages = data || [];
                agruparConversaciones(allMessages);
                setLoading(false);
            }
        } catch (error) {
            console.error("Error cargando mensajes:", error);
            setLoading(false);
        }
    };

    const agruparConversaciones = (mensajes) => {
        const grupos = {};

        mensajes.forEach(msg => {
            const remitenteId = msg.remitente.id;
            const destinatarioId = msg.destinatario.id;
            const soyYoRemitente = remitenteId === user.id;
            const otroUsuario = soyYoRemitente ? msg.destinatario : msg.remitente;
            const otroId = soyYoRemitente ? destinatarioId : remitenteId;

            if (!grupos[otroId]) {
                grupos[otroId] = {
                    usuario: otroUsuario,
                    mensajes: [],
                    ultimoMensaje: null,
                    noLeidos: 0
                };
            }

            grupos[otroId].mensajes.push(msg);
            
            if (!grupos[otroId].ultimoMensaje) {
                grupos[otroId].ultimoMensaje = msg;
            }

            if (!soyYoRemitente && !msg.leido) {
                grupos[otroId].noLeidos++;
            }
        });

        const lista = Object.values(grupos).sort((a, b) => {
            const dateA = new Date(a.ultimoMensaje.fechaEnvio);
            const dateB = new Date(b.ultimoMensaje.fechaEnvio);
            return dateB - dateA;
        });

        if (selectedUser) {
            const exists = lista.find(c => c.usuario.id === selectedUser.id);
            if (!exists) {
                lista.unshift({
                    usuario: selectedUser,
                    mensajes: [],
                    ultimoMensaje: { fechaEnvio: new Date(), texto: '' },
                    noLeidos: 0,
                    isTemp: true
                });
            }
        }

        // Optimización: Solo actualizar estado si hay cambios reales en la estructura
        // (Para simplificar, actualizamos siempre, pero el control de scroll lo maneja el useEffect)
        setConversaciones(lista);
    };

    const markAsRead = async (userId) => {
        setConversaciones(prev => prev.map(chat => {
            if (chat.usuario.id === userId) {
                return { ...chat, noLeidos: 0 };
            }
            return chat;
        }));

        const chat = conversaciones.find(c => c.usuario.id === userId);
        if (!chat) return;

        const unreadMessages = chat.mensajes.filter(msg => 
            msg.remitente.id === userId && !msg.leido
        );

        if (unreadMessages.length === 0) return;

        try {
            await Promise.all(unreadMessages.map(msg => 
                fetch(getApiUrl(`/api/mensajes/${msg.id}`), {
                    method: 'PATCH',
                    headers: { 
                        'Content-Type': 'application/merge-patch+json',
                        'Accept': 'application/ld+json'
                    },
                    body: JSON.stringify({ leido: true }),
                    credentials: 'include'
                })
            ));
            fetchMensajes();
        } catch (error) {
            console.error("Error marcando como leídos:", error);
        }
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        markAsRead(user.id);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedUser) return;

        setSending(true);
        try {
            const payload = {
                texto: newMessage,
                destinatario: `/api/users/${selectedUser.id}`
            };

            const response = await fetch(getApiUrl('/api/mensajes'), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/ld+json',
                    'Accept': 'application/ld+json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (response.ok) {
                setNewMessage('');
                fetchMensajes();
                // Forzar scroll al enviar
                isUserNearBottom.current = true;
                scrollToBottom();
            } else {
                alert("Error al enviar mensaje");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSending(false);
        }
    };

    const handleBackToConversations = () => {
        setSelectedUser(null);
    };

    const filteredConversations = conversaciones.filter(c => {
        const nombre = `${c.usuario.nombre} ${c.usuario.apellidos || ''}`.toLowerCase();
        return nombre.includes(searchTerm.toLowerCase());
    });

    return (
        <Layout fullHeight={true}>
            <div className={styles.container}>
                <div style={{ padding: '1rem', display: selectedUser && window.innerWidth <= 768 ? 'none' : 'block' }}>
                    <CrudHeader title="Mensajería" />
                </div>
                
                <div className={styles.chatLayout}>
                    <div className={`${styles.sidebar} ${selectedUser ? styles.hidden : ''}`}>
                        <div className={styles.searchWrapper}>
                            <SearchBar 
                                value={searchTerm} 
                                onChange={setSearchTerm} 
                                placeholder="Buscar conversación..." 
                                fields={[]}
                            />
                        </div>
                        
                        <div className={styles.conversationList}>
                            {filteredConversations.map(chat => (
                                <div 
                                    key={chat.usuario.id} 
                                    className={`${styles.conversationItem} ${selectedUser?.id === chat.usuario.id ? styles.active : ''}`}
                                    onClick={() => handleSelectUser(chat.usuario)}
                                >
                                    <div className={styles.avatar}>
                                        {chat.usuario.foto ? (
                                            <img src={getAssetUrl(chat.usuario.foto)} alt="" />
                                        ) : (
                                            <User size={20} />
                                        )}
                                    </div>
                                    <div className={styles.conversationInfo}>
                                        <div className={styles.conversationHeader}>
                                            <span className={styles.userName}>{chat.usuario.nombre} {chat.usuario.apellidos}</span>
                                            <span className={styles.time}>
                                                {chat.isTemp ? 'Nuevo' : new Date(chat.ultimoMensaje.fechaEnvio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        <div className={styles.lastMessage}>
                                            {chat.isTemp ? 'Inicia la conversación' : (
                                                <>
                                                    {chat.ultimoMensaje.remitente.id === user.id ? 'Tú: ' : ''}
                                                    {chat.ultimoMensaje.texto}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {chat.noLeidos > 0 && (
                                        <div className={styles.unreadBadge}>{chat.noLeidos}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={`${styles.chatArea} ${selectedUser ? styles.visible : ''}`}>
                        {selectedUser ? (
                            <>
                                <div className={styles.chatHeader}>
                                    <button className={styles.backButton} onClick={handleBackToConversations}>
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className={styles.avatarSmall}>
                                        {selectedUser.foto ? (
                                            <img src={getAssetUrl(selectedUser.foto)} alt="" />
                                        ) : (
                                            <User size={16} />
                                        )}
                                    </div>
                                    <span className={styles.chatUserName}>{selectedUser.nombre} {selectedUser.apellidos}</span>
                                </div>

                                <div 
                                    className={styles.messagesContainer} 
                                    ref={messagesContainerRef}
                                    onScroll={handleScroll}
                                >
                                    {mensajesChat.length === 0 ? (
                                        <div className={styles.emptyChat}>
                                            <p>No hay mensajes. ¡Saluda!</p>
                                        </div>
                                    ) : (
                                        [...mensajesChat].reverse().map(msg => {
                                            const remitenteId = msg.remitente.id;
                                            const isMe = remitenteId === user.id;
                                            return (
                                                <div key={msg.id} className={`${styles.messageBubble} ${isMe ? styles.sent : styles.received}`}>
                                                    <div className={styles.messageContent}>
                                                        {msg.texto}
                                                    </div>
                                                    <div className={styles.messageTime}>
                                                        {new Date(msg.fechaEnvio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                <form onSubmit={handleSendMessage} className={styles.inputArea}>
                                    <input 
                                        type="text" 
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Escribe un mensaje..."
                                        className={styles.messageInput}
                                        disabled={sending}
                                    />
                                    <Button type="submit" disabled={sending || !newMessage.trim()}>
                                        <Send size={18} />
                                    </Button>
                                </form>
                            </>
                        ) : (
                            <div className={styles.emptyChat}>
                                <p>Selecciona una conversación para empezar a chatear</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Mensajes;
