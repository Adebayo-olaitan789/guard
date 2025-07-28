import { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import emailjs from '@emailjs/browser';

function ChatSection({ user, db, emailjsConfig }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isHumanChat, setIsHumanChat] = useState(false);
  const [chatId, setChatId] = useState(null);

  useEffect(() => {
    if (user && chatId) {
      const unsubscribe = onSnapshot(doc(db, 'chats', chatId), (doc) => {
        if (doc.exists()) {
          setMessages(doc.data().messages || []);
        }
      });
      return () => unsubscribe();
    }
  }, [user, chatId, db]);

  const simulateAIResponse = (message) => {
    return `AI: Thanks for your question: "${message}". For detailed help, consider switching to a human agent.`;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (!user) {
      alert('Please log in to chat.');
      return;
    }

    if (!chatId) {
      const newChat = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        userEmail: user.email,
        messages: [{ text: input, sender: 'user', timestamp: new Date() }],
        isHuman: isHumanChat
      });
      setChatId(newChat.id);
    } else {
      await updateDoc(doc(db, 'chats', chatId), {
        messages: arrayUnion({
          text: input,
          sender: 'user',
          timestamp: new Date()
        })
      });
    }

    if (!isHumanChat) {
      const aiResponse = simulateAIResponse(input);
      await updateDoc(doc(db, 'chats', chatId), {
        messages: arrayUnion({
          text: aiResponse,
          sender: 'ai',
          timestamp: new Date()
        })
      });
    } else {
      emailjs.send(emailjsConfig.serviceId, emailjsConfig.templateId, {
        user_email: user.email,
        message: input,
        chat_id: chatId
      }, emailjsConfig.userId).then(() => console.log('Notification sent!'));
    }

    setInput('');
  };

  const switchToHuman = async () => {
    if (!chatId) return;
    await updateDoc(doc(db, 'chats', chatId), { isHuman: true });
    setIsHumanChat(true);
    emailjs.send(emailjsConfig.serviceId, emailjsConfig.templateId, {
      user_email: user.email,
      message: 'User requested human agent.',
      chat_id: chatId
    }, emailjsConfig.userId).then(() => console.log('Agent notified!'));
  };

  return (
    <div className="my-5">
      <h2>Customer Support Chat</h2>
      <div className="card">
        <div className="card-body" style={{ height: '300px', overflowY: 'scroll' }}>
          {messages.map((msg, index) => (
            <div key={index} className={`mb-2 ${msg.sender === 'user' ? 'text-end' : ''}`}>
              <strong>{msg.sender === 'user' ? 'You' : msg.sender === 'ai' ? 'AI' : 'Agent'}:</strong> {msg.text}
              {msg.image && <img src={msg.image} alt="Uploaded" className="img-fluid mt-2" style={{ maxWidth: '200px' }} />}
            </div>
          ))}
        </div>
        <div className="card-footer">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button className="btn btn-primary" onClick={sendMessage}>Send</button>
          </div>
          {!isHumanChat && (
            <button className="btn btn-secondary mt-2" onClick={switchToHuman}>
              Switch to Human Agent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatSection;
