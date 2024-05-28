"use client";
import axios from "axios";
import { useCallback, useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";

export default function Home() {
  const [nickname, setNickname] = useState('');
  const [text, setMessage] = useState('');
  const [messages, setMessages] = useState<{ id: string, nickname: string, text: string, time: string, readAt: string, tokenUser: string }[]>([]);
  const [isAuth, setIsAuth] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const [channelId, setChannelId] = useState('');
  
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
    axios.get('https://cce3-103-190-47-18.ngrok-free.app/api/v1/chat-room/90e69ba9-3ef9-45c3-8a0c-96a0ff7f7f29', {
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
          time: msg.created_at,
          readAt: msg.read_at,
          tokenUser: localStorage.getItem('token')
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
    const socketInstance = io("https://cce3-103-190-47-18.ngrok-free.app", {
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

        // Use ref values instead of state values
        const currentNickname = nicknameRef.current;
        const currentText = textRef.current;
        const currentChannelId = localStorage.getItem('channel');

        socketInstance.emit('subscribeToChannel', { channelId: currentChannelId });

        socketInstance.emit('sendMessage', { channelId: currentChannelId, content: { nickname: currentNickname, text: currentText } });
        setMessage(''); // Clear message input after sending
      } else {
        window.alert('Invalid message');
      }
    });

    socketInstance.on('text-chat', (msg: { id: string, nickname: string, text: string, time: string, readAt: string, tokenUser: string }) => {
      console.log(msg);
      setMessages(oldMessages => {
        const newMessages = [...oldMessages, msg];
    
        // Bisa dibuatkan method terpisah nanti
        const parsed = Array.isArray(newMessages) ? newMessages : [newMessages];
        console.log(newMessages);
        const unreadMessages = parsed.filter(message => !message.readAt).map(message => message.id);
        
        console.log(msg.tokenUser)
        console.log(localStorage.getItem('token'))

        if (unreadMessages.length > 0 /* && msg.tokenUser != localStorage.getItem('token') */) {
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
            message.readAt = readData.read_at;
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

  const subscribeToChannel = () => {
    updateRefs(); // Update refs before using them
    if (channelId && socket) {
      localStorage.setItem("channel", channelId);
      socket.emit('subscribeToChannel', { channelId });
    }
  };

  const unsubscribeFromChannel = () => {
    updateRefs(); // Update refs before using them
    if (channelId && socket) {
      socket.emit('unsubscribeFromChannel', { channelId });
    }
  };

  const sendMessage = () => {
    updateRefs(); // Update refs before using them
    if (nickname && text && socket && channelId) {
      socket.emit('sendMessage', { channelId, content: { nickname, text } });
      setMessage(''); // Clear message input after sending
    }
  };

  return (
    <div>
      <h1>Chat App</h1>
      <div>
        {messages.map((msg, index) => (
          <div key={index}>
            <p>ID: {msg.id}</p>
            <p>Nickname: {msg.nickname}</p>
            <p>Message: {msg.text}</p>
            <p>Time: {msg.time}</p>
            <p>Read At: {msg.readAt}</p>
            <br />
            <br />
          </div>
        ))}
      </div>
      {isAuth ? (
        <>
          <input 
            type="text" 
            placeholder="Your nickname" 
            value={nickname} 
            onChange={(e) => {
              setNickname(e.target.value);
              nicknameRef.current = e.target.value; // Update ref when value changes
            }} 
          />
          <input 
            type="text" 
            placeholder="Channel ID" 
            value={channelId} 
            onChange={(e) => {
              setChannelId(e.target.value);
              channelIdRef.current = e.target.value; // Update ref when value changes
            }} 
          />
          <button onClick={subscribeToChannel}>Join Channel</button>
          <button onClick={unsubscribeFromChannel}>Unsubscribe from Channel</button>
          <input 
            type="text" 
            placeholder="Your message" 
            value={text} 
            onChange={(e) => {
              setMessage(e.target.value);
              textRef.current = e.target.value; // Update ref when value changes
            }} 
          />
          <button onClick={sendMessage}>Send</button>
        </>
      ) : (
        <button onClick={authenticate}>Authenticate</button>
      )}
    </div>
  );
}
