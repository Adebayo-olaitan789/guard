import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function AgentDashboard({ user, db, storage, emailjsConfig }) {
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'chats'), where('isHuman', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(chatData);
    });
    return () => unsubscribe();
  }, [db]);

  useEffect(() => {
    if (selectedChatId) {
      const unsubscribe = onSnapshot(doc(db, 'chats', selectedChatId), (doc) => {
        if (doc.exists()) {
          setMessages(doc.data().messages || []);
        }
      });
      return () => unsubscribe();
    }
  }, [selectedChatId, db]);

  const sendMessage = async () => {
    if (!input.trim() && !image) return;

    const messageData = { text: input, sender: 'agent', timestamp: new Date() };

    if (image) {
      const storageRef = ref(storage, `chat_images/${selectedChatId}/${image.name}`);
      await uploadBytes(storageRef, image);
      const imageUrl = await getDownloadURL(storageRef);
      messageData.image = imageUrl;
    }

    await updateDoc(doc(db, 'chats', selectedChatId), {
      messages: arrayUnion(messageData)
    });

    setInput('');
    setImage(null);
  };

  return (
    <div className="mt-4">
      <h1>Agent Dashboard</h1>
      <div className="row">
        <div className="col-md-4">
          <h3>Active Chats</h3>
          <ul className="list-group">
            {chats.map(chat => (
              <li
                key={chat.id}
                className={`list-group-item ${selectedChatId === chat.id ? 'active' : ''}`}
                onClick={() => setSelectedChatId(chat.id)}
              >
                {chat.userEmail}
              </li>
            ))}
          </ul>
        </div>
        <div className="col-md-8">
          {selectedChatId && (
            <>
              <h3>Chat with {chats.find(c => c.id === selectedChatId)?.userEmail}</h3>
              <div className="card">
                <div className="card-body" style={{ height: '400px', overflowY: 'scroll' }}>
                  {messages.map((msg, index) => (
                    <div key={index} className={`mb-2 ${msg.sender === 'agent' ? 'text-end' : ''}`}>
                      <strong>{msg.sender === 'user' ? 'User' : msg.sender === 'ai' ? 'AI' : 'You'}:</strong> {msg.text}
                      {msg.image && <img src={msg.image} alt="Uploaded" className="img-fluid mt-2" style={{ maxWidth: '200px' }} />}
                    </div>
                  ))}
                </div>
                <div className="card-footer">
                  <div className="input-group mb-2">
                    <input
                      type="text"
                      className="form-control"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type your response..."
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button className="btn btn-primary" onClick={sendMessage}>Send</button>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-control"
                    onChange={(e) => setImage(e.target.files[0])}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentDashboard;
