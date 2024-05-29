"use client";
import axios from "axios";
import { useCallback, useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";

export default function Home() {
  const [nickname, setNickname] = useState('');
  const [text, setMessage] = useState('');
  const [messages, setMessages] = useState<{ id: string, nickname: string, text: string, created_at: string, read_at: string, user_id: string }[]>([]);
  const [isAuth, setIsAuth] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const [channelId] = useState('90e69ba9-3ef9-45c3-8a0c-96a0ff7f7f29'); // Predefined channel ID
  
  // Refs to keep track of current state values
  const nicknameRef = useRef(nickname);
  const textRef = useRef(text);
  const channelIdRef = useRef(channelId);

  // Update refs whenever state changes
  const updateRefs = () => {
    nicknameRef.current = nickname;
    textRef.current = text;
    channelIdRef.current = channelId;
  };

  useEffect(() => {
    axios.get('https://4de7-103-100-175-245.ngrok-free.app/api/v1/chat-room/90e69ba9-3ef9-45c3-8a0c-96a0ff7f7f29', {
      headers: {
        'ngrok-skip-browser-warning': 'skip-browser-warning'
      }
    })
      .then(response => {
        console.log(response);
        const newMessages = response.data.messages.map((msg: any) => ({
          id: msg.id,
          nickname: msg.user.role.name,
          text: msg.text,
          created_at: msg.created_at,
          read_at: msg.read_at,
          user_id: msg.user_id
        }));
  
        setMessages(newMessages); // Set initial messages
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  }, []); // Empty dependency array ensures this runs once on mount
  

  const authenticate = useCallback(() => {
    setIsAuth(true);
    console.log(messages)
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const socketInstance = io("https://4de7-103-100-175-245.ngrok-free.app", {
      auth: {
        token: `Bearer ${token}`
      },
      extraHeaders: {
        'ngrok-skip-browser-warning': 'skip-browser-warning'
      }
    });
    setSocket(socketInstance);

    socketInstance.on('error', (error) => {
      if (error.message === 'You are not joined to this channel') {
        console.error('Error:', error.message);

        axios.get('https://4de7-103-100-175-245.ngrok-free.app/api/v1/chat-room/90e69ba9-3ef9-45c3-8a0c-96a0ff7f7f29', {
          headers: {
            'ngrok-skip-browser-warning': 'skip-browser-warning'
          }
        })
          .then(response => {
            console.log(response);
            const newMessages = response.data.messages.map((msg: any) => ({
              id: msg.id,
              nickname: msg.user.role.name,
              text: msg.text,
              created_at: msg.created_at,
              read_at: msg.read_at,
              user_id: msg.user_id
            }));
      
            setMessages(newMessages); // Set initial messages
            window.alert('You are now connected to the channel');
          })
          .catch(error => {
            console.error('Error fetching data:', error);
          });

        // Use ref values instead of state values
        const currentNickname = nicknameRef.current;
        const currentText = textRef.current;
        const currentChannelId = channelIdRef.current;

        socketInstance.emit('subscribeToChannel', { channelId: currentChannelId });

        // Allow sending message only after the alert
        /* socketInstance.emit('sendMessage', { channelId: currentChannelId, content: { nickname: currentNickname, text: currentText } }); */
        //setMessage(''); // Clear message input after sending
      } else {
        window.alert('Invalid message');
      }
    });

    socketInstance.on('text-chat', (msg: { id: string, nickname: string, text: string, created_at: string, read_at: string, user_id: string }) => {
      console.log(msg);
      setMessages(oldMessages => {
        
        const newMessages = [...oldMessages, msg];
    
        // Bisa dibuatkan method terpisah nanti
        const parsed = Array.isArray(newMessages) ? newMessages : [newMessages];
        console.log(newMessages);
        const unreadMessages = parsed.filter(message => !message.read_at).map(message => message.id);
        
        console.log(msg.user_id)
        console.log(localStorage.getItem('token'))

        if (unreadMessages.length > 0 /* && msg.user_id != localStorage.getItem('token') */) {
          console.log(unreadMessages);
          socketInstance.emit('markAsRead', { messageId: unreadMessages, channelId: channelIdRef.current });
        }
        
        return newMessages;
      });
    });
    

    socketInstance.on('messageRead', (datas: { messageId: { id: string, read_at: string }[] }) => {
      setMessages(oldMessages => {
        const updatedMessages = oldMessages.map(message => {
          const readData = datas.messageId.find(data => data.id === message.id);
          if (readData) {
            message.read_at = readData.read_at;
          }
          return message;
        });
        return updatedMessages;
      });
    });

    socketInstance.on('exception', (error: string) => {
      window.alert('Invalid message: ' + error);
    });
  }, []);

  const sendMessage = () => {
    updateRefs(); // Update refs before using them
    if (nickname && text && socket && channelId) {
      socket.emit('sendMessage', { channelId, content: { nickname, text } });
      setMessage(''); // Clear message input after sending
    }
  };

  return (
    <div style={styles.container}>
      <h1>Chat App</h1>
      <div style={styles.chatBox}>
        <div style={styles.messageList}>
          {messages.map((msg, index) => {
            const isOwnMessage = localStorage.getItem('user') === msg.user_id;
            return (
              <div 
                key={index} 
                style={{...styles.message, alignSelf: isOwnMessage ? 'flex-start' : 'flex-end', backgroundColor: isOwnMessage ? '#d1e7dd' : '#e9e9e9' }}>
                <p><strong>{msg.nickname}</strong>: {msg.text}</p>
                <p style={styles.messageTime}>{msg.created_at}</p>
                {msg.read_at && <p style={styles.messageTime}>Read at: {msg.read_at}</p>}
              </div>
            );
          })}
        </div>
        <div style={styles.inputBox}>
          <input 
            type="text" 
            placeholder="Your nickname" 
            value={nickname} 
            onChange={(e) => {
              setNickname(e.target.value);
              nicknameRef.current = e.target.value; // Update ref when value changes
            }} 
            style={styles.input}
          />
          <input 
            type="text" 
            placeholder="Your message" 
            value={text} 
            onChange={(e) => {
              setMessage(e.target.value);
              textRef.current = e.target.value; // Update ref when value changes
            }} 
            style={styles.input}
          />
          <button onClick={sendMessage} style={styles.button}>Send</button>
        </div>
      </div>
      {!isAuth && (
        <button onClick={authenticate} style={styles.authButton}>Authenticate</button>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#f0f0f0',
    fontFamily: 'Arial, sans-serif',
  },
  chatBox: {
    width: '90%',
    maxWidth: '600px',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column' as 'column',
    overflow: 'hidden',
  },
  messageList: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as 'column',
    padding: '10px',
    overflowY: 'scroll' as 'scroll',
  },
  message: {
    marginBottom: '10px',
    padding: '10px',
    borderRadius: '5px',
    maxWidth: '70%',
    wordWrap: 'break-word' as 'break-word',
  },
  messageTime: {
    fontSize: '0.8em',
    color: '#555',
  },
  inputBox: {
    display: 'flex',
    padding: '10px',
    borderTop: '1px solid #ddd',
  },
  input: {
    flex: 1,
    padding: '10px',
    marginRight: '10px',
    borderRadius: '5px',
    border: '1px solid #ddd',
  },
  button: {
    padding: '10px 20px',
    borderRadius: '5px',
    border: 'none',
    backgroundColor: '#007BFF',
    color: '#fff',
    cursor: 'pointer',
  },
  authButton: {
    marginTop: '20px',
    padding: '10px 20px',
    borderRadius: '5px',
    border: 'none',
    backgroundColor: '#28a745',
    color: '#fff',
    cursor: 'pointer',
  }
};
