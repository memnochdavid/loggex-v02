import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom'; // Importar useLocation
import Layout from '../components/Layout';
import CrudHeader from '../components/CrudHeader';
import SearchBar from '../components/SearchBar'; // Importar SearchBar
import { useAuth } from '../context/AuthContext';
import styles from './Mensajes.module.css';
import { Send, User } from 'lucide-react';
import Button from '../components/Button';

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

    useEffect(() => {
        if (user) {
            fetchMensajes();
            const interval = setInterval(fetchMensajes, 10000);
            return () => clearInterval(interval);
        }
    }, [user]);

    useEffect(() => {
        if (location.state?.chatWith && !loading) {
            const targetUser = location.state.chatWith;
            const existingChat = conversaciones.find(c => c.usuario.id === targetUser.id);
            
            if (existingChat) {
                setSelectedUser(existingChat.usuario);
            } else {
                const newChat = {
                    usuario: targetUser,
                    mensajes: [],
                    ultimoMensaje: { fechaEnvio: new Date(), texto: 'Nueva conversación' },
                    noLeidos: 0,
                    isTemp: true
                };
                setConversaciones(prev => [newChat, ...prev]);
                setSelectedUser(targetUser);
            }
            window.history.replaceState({}, document.title);
        }
    }, [location.state, loading, conversaciones]);

    useEffect(() => {
        if (selectedUser) {
            const chat = conversaciones.find(c => c.usuario.id === selectedUser.id);
            if (chat) {
                setMensajesChat(chat.mensajes);
            } else {
                setMensajesChat([]);
            }
        }
    }, [conversaciones, selectedUser]);

    useEffect(() => {
        scrollToBottom();
    }, [mensajesChat]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchMensajes = async () => {
        try {
            const response = await fetch('https://localhost:9443/api/v1/mensajes', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                const allMessages = data || [];
                agruparConversaciones(allMessages);
                setLoading(false);
            } else {
                console.error("Error fetching mensajes:", response.status);
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

        setConversaciones(lista);
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

            const response = await fetch('https://localhost:9443/api/mensajes', {
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
            } else {
                alert("Error al enviar mensaje");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSending(false);
        }
    };

    const filteredConversations = conversaciones.filter(c => {
        const nombre = `${c.usuario.nombre} ${c.usuario.apellidos || ''}`.toLowerCase();
        return nombre.includes(searchTerm.toLowerCase());
    });

    return (
        <Layout fullHeight={true}>
            <div className={styles.container}>
                <div style={{ padding: '1rem' }}>
                    <CrudHeader title="Mensajería" />
                </div>
                
                <div className={styles.chatLayout}>
                    <div className={styles.sidebar}>
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
                                    onClick={() => setSelectedUser(chat.usuario)}
                                >
                                    <div className={styles.avatar}>
                                        {chat.usuario.foto ? (
                                            <img src={`https://localhost:9443${chat.usuario.foto}`} alt="" />
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

                    <div className={styles.chatArea}>
                        {selectedUser ? (
                            <>
                                <div className={styles.chatHeader}>
                                    <div className={styles.avatarSmall}>
                                        {selectedUser.foto ? (
                                            <img src={`https://localhost:9443${selectedUser.foto}`} alt="" />
                                        ) : (
                                            <User size={16} />
                                        )}
                                    </div>
                                    <span className={styles.chatUserName}>{selectedUser.nombre} {selectedUser.apellidos}</span>
                                </div>

                                <div className={styles.messagesContainer}>
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
