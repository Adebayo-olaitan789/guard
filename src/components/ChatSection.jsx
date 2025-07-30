import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDoc,
} from "firebase/firestore";
import emailjs from "@emailjs/browser";
import "bootstrap/dist/css/bootstrap.min.css";
import "./ChatSection.css";

function ChatSection({ user, db, emailjsConfig }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatId, setChatId] = useState(null);
  const [isHuman, setIsHuman] = useState(false);
  const [showAgentButton, setShowAgentButton] = useState(false);
  const [userDetails, setUserDetails] = useState({ name: "", email: "" });
  const [showDetailsForm, setShowDetailsForm] = useState(true);

  useEffect(() => {
    if (user) {
      const updateLastActive = async () => {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { lastActive: new Date().toISOString() });
      };
      updateLastActive();
      const interval = setInterval(updateLastActive, 60000); // Update every minute
      const q = query(collection(db, "chats"), where("userId", "==", user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const chatDoc = snapshot.docs[0];
          setChatId(chatDoc.id);
          setMessages(chatDoc.data().messages || []);
          setIsHuman(chatDoc.data().isHuman || false);
          setShowAgentButton(chatDoc.data().messages?.length > 0);
          setShowDetailsForm(false);
          setUserDetails({
            name: chatDoc.data().userDisplayName || user.displayName,
            email: chatDoc.data().userEmail || user.email,
          });
        } else {
          setMessages([]);
          setChatId(null);
          setIsHuman(false);
          setShowAgentButton(false);
          setShowDetailsForm(true);
          setUserDetails({ name: user.displayName, email: user.email });
        }
      });
      return () => {
        unsubscribe();
        clearInterval(interval);
      };
    }
  }, [user, db]);

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    if (!userDetails.name || !userDetails.email) return;
    try {
      const newChat = await addDoc(collection(db, "chats"), {
        userId: user.uid,
        userEmail: userDetails.email,
        userDisplayName: userDetails.name,
        messages: [],
        isHuman: false,
      });
      setChatId(newChat.id);
      setShowDetailsForm(false);
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim() || !chatId) return;

    try {
      const chatRef = doc(db, "chats", chatId);
      const updatedMessages = [
        ...messages,
        {
          sender: "user",
          text: newMessage,
          timestamp: new Date().toISOString(),
          userName: userDetails.name,
          userEmail: userDetails.email,
        },
      ];
      await updateDoc(chatRef, { messages: updatedMessages });
      if (updatedMessages.length === 1) {
        setShowAgentButton(true);
      }
      if (isHuman) {
        const agentDocRef = doc(db, "agents", "emails");
        const agentDoc = await getDoc(agentDocRef);
        if (agentDoc.exists()) {
          const agentEmails = agentDoc.data().emails || [];
          for (const email of agentEmails) {
            await emailjs.send(
              emailjsConfig.serviceId,
              emailjsConfig.templateId,
              {
                user_email: email,
                message: `New message from ${userDetails.name} (${userDetails.email}): ${newMessage}`,
              },
              emailjsConfig.userId
            );
          }
        }
      }
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleSwitchToHuman = async () => {
    if (!chatId) return;
    try {
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, { isHuman: true });
      const agentDocRef = doc(db, "agents", "emails");
      const agentDoc = await getDoc(agentDocRef);
      if (agentDoc.exists()) {
        const agentEmails = agentDoc.data().emails || [];
        for (const email of agentEmails) {
          await sendEmail(
            emailjsConfig.serviceId,
            emailjsConfig.templateId,
            {
              user_email: email,
              message: `A user (${userDetails.name}) has requested human assistance.`,
            },
            emailjsConfig.userId
          );
        }
      }
      setIsHuman(true);
    } catch (error) {
      console.error("Error switching to human:", error);
    }
  };

  const handleBackToForm = () => {
    setShowDetailsForm(true);
    setChatId(null);
    setMessages([]);
    setIsHuman(false);
    setShowAgentButton(false);
  };

  return (
    <div className="chat-section card">
      <div className="card-header bg-primary text-white d-flex align-items-center">
        <i className="bi bi-chat-fill me-2"></i>Chat with Us
        {!showDetailsForm && (
          <button
            className="btn btn-link text-white d-md-none ms-2"
            onClick={handleBackToForm}
          >
            <i className="bi bi-arrow-left"></i>
          </button>
        )}
      </div>
      <div className="card-body chat-body">
        {showDetailsForm && user ? (
          <form onSubmit={handleDetailsSubmit} className="mb-3">
            <div className="mb-3">
              <label htmlFor="userName" className="form-label">
                Your Name
              </label>
              <input
                type="text"
                className="form-control"
                id="userName"
                value={userDetails.name}
                onChange={(e) =>
                  setUserDetails({ ...userDetails, name: e.target.value })
                }
                placeholder="Enter your name"
              />
            </div>
            <div className="mb-3">
              <label htmlFor="userEmail" className="form-label">
                Your Email
              </label>
              <input
                type="email"
                className="form-control"
                id="userEmail"
                value={userDetails.email}
                onChange={(e) =>
                  setUserDetails({ ...userDetails, email: e.target.value })
                }
                placeholder="Enter your email"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Start Chat
            </button>
          </form>
        ) : (
          <>
            {messages.length > 0 ? (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`chat-message d-flex ${
                    msg.sender === "user"
                      ? "justify-content-end"
                      : "justify-content-start"
                  } mb-2`}
                >
                  <div className="d-flex align-items-end">
                    {msg.sender !== "user" && (
                      <i
                        className="bi bi-person-circle text-secondary me-2"
                        style={{ fontSize: "30px" }}
                      ></i>
                    )}
                    <div
                      className={`p-2 rounded ${
                        msg.sender === "user"
                          ? "bg-primary text-white"
                          : "bg-secondary text-white"
                      }`}
                      style={{ maxWidth: "70%" }}
                    >
                      <strong>
                        {msg.sender === "user"
                          ? `${msg.userName} (${msg.userEmail})`
                          : `${msg.agentName} (${msg.agentEmail})`}
                        :
                      </strong>{" "}
                      {msg.text}
                      <div className="small text-light opacity-75">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    {msg.sender === "user" && (
                      <i
                        className="bi bi-person-circle text-primary ms-2"
                        style={{ fontSize: "30px" }}
                      ></i>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted text-center">Start the conversation!</p>
            )}
            {showAgentButton && !isHuman && (
              <div className="text-center my-3">
                <p className="mb-2">
                  Would you like to talk to one of our agents?
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={handleSwitchToHuman}
                >
                  Talk to Agent
                </button>
              </div>
            )}
            {user && !showDetailsForm && (
              <div className="input-group mt-3">
                <input
                  type="text"
                  className="form-control"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                />
                <button className="btn btn-primary" onClick={handleSendMessage}>
                  Send
                </button>
              </div>
            )}
          </>
        )}
        {!user && (
          <p className="text-center">Please log in to send messages.</p>
        )}
      </div>
    </div>
  );
}

export default ChatSection;
