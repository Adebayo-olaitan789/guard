import { useState, useEffect, useRef } from "react";
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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import emailjs from "@emailjs/browser";
import "bootstrap/dist/css/bootstrap.min.css";
import "./ChatSection.css";

function ChatSection({ user, db, storage, emailjsConfig }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatId, setChatId] = useState(null);
  const [isHuman, setIsHuman] = useState(false);
  const [showAgentButton, setShowAgentButton] = useState(false);
  const [userDetails, setUserDetails] = useState({ name: "", email: "" });
  const [showDetailsForm, setShowDetailsForm] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [chatError, setChatError] = useState(null);
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user || !db) {
      setChatError("Please log in to view chats.");
      setShowDetailsForm(true);
      return;
    }

    const updateLastActive = async () => {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { lastActive: new Date().toISOString() });
      } catch (error) {
        console.error("Error updating last active:", error);
        setChatError("Failed to update user status.");
      }
    };
    updateLastActive();
    const interval = setInterval(updateLastActive, 60000);

    const q = query(collection(db, "chats"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const chatDoc = snapshot.docs[0];
          setChatId(chatDoc.id);
          setMessages(chatDoc.data().messages || []);
          setIsHuman(chatDoc.data().isHuman || false);
          setShowAgentButton(chatDoc.data().messages?.length > 0);
          setShowDetailsForm(false);
          setUserDetails({
            name:
              chatDoc.data().userDisplayName ||
              user.displayName ||
              user.email.split("@")[0],
            email: chatDoc.data().userEmail || user.email,
          });
          setIsAgentTyping(chatDoc.data().typing?.agent || false);
        } else {
          setMessages([]);
          setChatId(null);
          setIsHuman(false);
          setShowAgentButton(false);
          setShowDetailsForm(true);
          setUserDetails({
            name: user.displayName || user.email.split("@")[0],
            email: user.email,
          });
          setIsAgentTyping(false);
        }
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      },
      (error) => {
        console.error("Error fetching chat:", error);
        setChatError("Failed to load chat. Please try again.");
      }
    );

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [user, db]);

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    if (!userDetails.name || !userDetails.email) {
      setChatError("Please provide name and email.");
      return;
    }
    try {
      const newChat = await addDoc(collection(db, "chats"), {
        userId: user.uid,
        userEmail: userDetails.email,
        userDisplayName: userDetails.name,
        messages: [],
        isHuman: false,
        typing: { user: false, agent: false },
        lastRead: new Date().toISOString(),
      });
      setChatId(newChat.id);
      setShowDetailsForm(false);
      setChatError(null);
    } catch (error) {
      console.error("Error creating chat:", error);
      setChatError("Failed to start chat. Please try again.");
    }
  };

  const handleTyping = async () => {
    if (!chatId || !user) return;
    try {
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, { "typing.user": newMessage.length > 0 });
      if (typingTimeout) clearTimeout(typingTimeout);
      const timeout = setTimeout(async () => {
        await updateDoc(chatRef, { "typing.user": false });
      }, 3000);
      setTypingTimeout(timeout);
    } catch (error) {
      console.error("Error updating typing status:", error);
      setChatError("Failed to update typing status.");
    }
  };

  const handleSendMessage = async () => {
    if (!user || !chatId || (!newMessage.trim() && !file)) return;
    setIsSending(true);
    const tempMessage = {
      sender: "user",
      text: newMessage || (file ? "File uploaded" : ""),
      timestamp: new Date().toISOString(),
      userName: userDetails.name,
      userEmail: userDetails.email,
      fileUrl: null,
      isImage: false,
    };

    let fileUrl = null;
    let isImage = false;
    if (file) {
      isImage = file.type.startsWith("image/");
      const storagePath = isImage
        ? `chat-images/chat_${user.uid}/${Date.now()}_${file.name}`
        : `chat_files/chat_${user.uid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      fileUrl = await getDownloadURL(storageRef);
      tempMessage.fileUrl = fileUrl;
      tempMessage.isImage = isImage;
      tempMessage.text = isImage
        ? newMessage || "Image uploaded"
        : `File uploaded: ${file.name}`;
    }

    setMessages([...messages, tempMessage]);
    setNewMessage("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = null;

    try {
      const chatRef = doc(db, "chats", chatId);
      const updatedMessages = [...messages, tempMessage];
      await updateDoc(chatRef, {
        messages: updatedMessages,
        "typing.user": false,
        lastRead: new Date().toISOString(),
      });
      if (updatedMessages.length === 1) {
        setShowAgentButton(true);
      }
      if (isHuman) {
        const agentDocRef = doc(db, "agents", "emails");
        const agentDoc = await getDoc(agentDocRef);
        const fallbackEmails = [
          "anurudeen511@gmail.com", // Replace with your fallback Gmail addresses
          "sandy4556789@gmail.com",
        ];
        const agentEmails = agentDoc.exists()
          ? agentDoc.data().emails || fallbackEmails
          : fallbackEmails;
        console.log("Sending notifications to:", agentEmails); // Debug log
        for (const email of agentEmails) {
          try {
            const response = await emailjs.send(
              emailjsConfig.serviceId,
              emailjsConfig.templateId,
              {
                user_email: email,
                message: `New ${
                  file ? (isImage ? "image" : "file") : "message"
                } from ${userDetails.name} (${userDetails.email}): ${
                  tempMessage.text
                }${file ? ` (File: ${fileUrl})` : ""}`,
              },
              emailjsConfig.userId
            );
            console.log(`Email sent to ${email}:`, response);
          } catch (emailError) {
            console.error(`Failed to send email to ${email}:`, emailError);
            setChatError(`Failed to send notification to ${email}.`);
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(messages);
      setChatError("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSwitchToHuman = async () => {
    if (!chatId) return;
    try {
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        isHuman: true,
        lastRead: new Date().toISOString(),
      });
      const agentDocRef = doc(db, "agents", "emails");
      const agentDoc = await getDoc(agentDocRef);
      const fallbackEmails = [
        "agent1@gmail.com", // Replace with your fallback Gmail addresses
        "agent2@gmail.com",
      ];
      const agentEmails = agentDoc.exists()
        ? agentDoc.data().emails || fallbackEmails
        : fallbackEmails;
      console.log("Sending human switch notifications to:", agentEmails);
      for (const email of agentEmails) {
        try {
          const response = await emailjs.send(
            emailjsConfig.serviceId,
            emailjsConfig.templateId,
            {
              user_email: email,
              message: `A user (${userDetails.name}) has requested human assistance.`,
            },
            emailjsConfig.userId
          );
          console.log(`Human switch email sent to ${email}:`, response);
        } catch (emailError) {
          console.error(
            `Failed to send human switch email to ${email}:`,
            emailError
          );
          setChatError(
            `Failed to notify ${email} about human assistance request.`
          );
        }
      }
      setIsHuman(true);
    } catch (error) {
      console.error("Error switching to human:", error);
      setChatError("Failed to switch to human agent.");
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.size <= 5 * 1024 * 1024) {
      setFile(selectedFile);
    } else {
      setChatError("File size must be less than 5MB.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleBackToForm = () => {
    setShowDetailsForm(true);
    setChatId(null);
    setMessages([]);
    setIsHuman(false);
    setShowAgentButton(false);
    setIsAgentTyping(false);
    setChatError(null);
  };

  if (chatError) {
    return (
      <div className="chat-section card">
        <div className="alert alert-danger">{chatError}</div>
      </div>
    );
  }

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
            {isAgentTyping && (
              <div className="text-muted text-center mb-3">
                Agent is typing...
              </div>
            )}
            {messages.length > 0 ? (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`chat-message d-flex ${
                    msg.sender === "user"
                      ? "justify-content-end"
                      : "justify-content-start"
                  } mb-3`}
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
                      {msg.fileUrl && msg.isImage && (
                        <div>
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={msg.fileUrl}
                              alt="Chat attachment"
                              className="chat-image"
                              style={{ maxWidth: "200px", marginTop: "5px" }}
                            />
                          </a>
                        </div>
                      )}
                      {msg.fileUrl && !msg.isImage && (
                        <div>
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View File ({msg.text})
                          </a>
                        </div>
                      )}
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
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !isSending) handleSendMessage();
                  }}
                  placeholder="Type your message..."
                  disabled={isSending}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="form-control d-none"
                  id="fileInput"
                  accept="image/*,.pdf"
                />
                <label htmlFor="fileInput" className="btn btn-outline-primary">
                  <i className="bi bi-image"></i>
                </label>
                <button
                  className="btn btn-primary"
                  onClick={handleSendMessage}
                  disabled={isSending}
                >
                  {isSending ? (
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                    ></span>
                  ) : (
                    "Send"
                  )}
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
