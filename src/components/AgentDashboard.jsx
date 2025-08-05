import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import emailjs from "@emailjs/browser";
import "./AgentDashboard.css";

function AgentDashboard({ user, db, storage, emailjsConfig }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [reply, setReply] = useState("");
  const [file, setFile] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [isSending, setIsSending] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!user || !db) {
      setError("Please log in to access the dashboard.");
      return;
    }

    const q = query(collection(db, "chats"), where("isHuman", "==", true));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chatData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const uniqueChats = [];
        const seenUserIds = new Set();
        for (const chat of chatData) {
          if (!seenUserIds.has(chat.userId)) {
            seenUserIds.add(chat.userId);
            uniqueChats.push(chat);
          }
        }
        uniqueChats.sort((a, b) => {
          const aLatest =
            a.messages?.length > 0
              ? new Date(a.messages[a.messages.length - 1].timestamp)
              : new Date(0);
          const bLatest =
            b.messages?.length > 0
              ? new Date(b.messages[b.messages.length - 1].timestamp)
              : new Date(0);
          return bLatest - aLatest;
        });
        setChats(uniqueChats);
        if (selectedChat) {
          const updatedChat = uniqueChats.find(
            (chat) => chat.id === selectedChat.id
          );
          if (updatedChat) {
            setSelectedChat(updatedChat);
            setIsUserTyping(updatedChat.typing?.user || false);
          }
        }
      },
      (error) => {
        console.error("Error fetching chats:", error);
        setError("Failed to load chats. Please try again.");
      }
    );

    const onlineCheck = async () => {
      const onlineSet = new Set();
      for (const chat of chats) {
        const userDocRef = doc(db, "users", chat.userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().lastActive) {
          const lastActive = new Date(userDoc.data().lastActive);
          const now = new Date();
          if ((now - lastActive) / 1000 / 60 < 5) {
            onlineSet.add(chat.userId);
          }
        }
      }
      setOnlineUsers(onlineSet);
    };

    const interval = setInterval(onlineCheck, 30000);
    onlineCheck();
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [db, chats, selectedChat, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedChat?.messages]);

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setReply("");
    setFile(null);
    setIsUserTyping(chat.typing?.user || false);
    if (fileInputRef.current) fileInputRef.current.value = null;
    try {
      const chatRef = doc(db, "chats", chat.id);
      await updateDoc(chatRef, { lastRead: new Date().toISOString() });
    } catch (error) {
      console.error("Error updating lastRead:", error);
      setError("Failed to mark chat as read.");
    }
  };

  const handleTyping = async () => {
    if (!selectedChat || !user) return;
    try {
      const chatRef = doc(db, "chats", selectedChat.id);
      await updateDoc(chatRef, { "typing.agent": reply.length > 0 });
      if (typingTimeout) clearTimeout(typingTimeout);
      const timeout = setTimeout(async () => {
        await updateDoc(chatRef, { "typing.agent": false });
      }, 3000);
      setTypingTimeout(timeout);
    } catch (error) {
      console.error("Error updating typing status:", error);
      setError("Failed to update typing status.");
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || (!reply.trim() && !file)) return;
    setIsSending(true);
    let tempMessage = {
      sender: "agent",
      text: reply || "",
      timestamp: new Date().toISOString(),
      agentName: user.displayName,
      agentEmail: user.email,
    };

    let fileUrl = null;
    let isImage = false;
    if (file) {
      isImage = file.type.startsWith("image/");
      const storagePath = isImage
        ? `chat-images/${selectedChat.id}/${Date.now()}_${file.name}`
        : `chat_files/${selectedChat.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      fileUrl = await getDownloadURL(storageRef);
      tempMessage = {
        ...tempMessage,
        text: isImage
          ? reply || "Image uploaded"
          : `File uploaded: ${file.name}`,
        fileUrl,
        isImage,
      };
    }

    setSelectedChat({
      ...selectedChat,
      messages: [...selectedChat.messages, tempMessage],
    });
    setReply("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = null;

    try {
      const chatRef = doc(db, "chats", selectedChat.id);
      const updatedMessages = [...selectedChat.messages, tempMessage];
      await updateDoc(chatRef, {
        messages: updatedMessages,
        "typing.agent": false,
        lastRead: new Date().toISOString(),
      });

      const agentDocRef = doc(db, "agents", "emails");
      const agentDoc = await getDoc(agentDocRef);
      const fallbackEmails = [
        "anurudeen511@gmail.com", // Replace with your fallback Gmail addresses
        "sandy4556789@gmail.com",
      ];
      const agentEmails = agentDoc.exists()
        ? agentDoc.data().emails || fallbackEmails
        : fallbackEmails;
      console.log("Sending agent notifications to:", agentEmails);
      for (const email of agentEmails) {
        if (email !== user.email) {
          try {
            const response = await emailjs.send(
              emailjsConfig.serviceId,
              emailjsConfig.templateId,
              {
                user_email: email,
                message: `New ${isImage ? "image" : "file"} uploaded by ${
                  user.displayName
                } (${user.email}) to ${selectedChat.userDisplayName}: ${
                  tempMessage.text
                }${fileUrl ? ` (File: ${fileUrl})` : ""}`,
              },
              emailjsConfig.userId
            );
            console.log(`Agent email sent to ${email}:`, response);
          } catch (emailError) {
            console.error(
              `Failed to send agent email to ${email}:`,
              emailError
            );
            setError(`Failed to send notification to ${email}.`);
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to send message.");
      setSelectedChat({
        ...selectedChat,
        messages: selectedChat.messages,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.size < 5 * 1024 * 1024) {
      setFile(selectedFile);
    } else {
      setError("Please select a file smaller than 5MB.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleClearAllChats = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete all chat history? This cannot be undone."
      )
    ) {
      return;
    }
    try {
      const chatsQuery = query(
        collection(db, "chats"),
        where("isHuman", "==", true)
      );
      const snapshot = await getDocs(chatsQuery);
      const deletePromises = snapshot.docs.map((chatDoc) =>
        deleteDoc(chatDoc.ref)
      );
      await Promise.all(deletePromises);
      setChats([]);
      setSelectedChat(null);
      setError(null);
    } catch (error) {
      console.error("Error clearing chats:", error);
      setError("Failed to clear chat history. Please try again.");
    }
  };

  const getUnreadCount = (chat) => {
    if (!chat.lastRead || !chat.messages?.length) return 0;
    const lastReadTime = new Date(chat.lastRead);
    return chat.messages.filter(
      (msg) => new Date(msg.timestamp) > lastReadTime && msg.sender !== "agent"
    ).length;
  };

  if (error) {
    return (
      <div className="agent-dashboard container-fluid">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="agent-dashboard container-fluid">
      <div className="row h-100">
        <div
          className={`col-md-4 col-lg-3 chat-list ${
            selectedChat ? "d-none d-md-block" : "d-block"
          }`}
        >
          <div className="card">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <span>Active Chats</span>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleClearAllChats}
                title="Clear All Chats"
              >
                <i className="bi bi-trash"></i>
              </button>
            </div>
            <ul className="list-group list-group-flush">
              {chats.map((chat) => (
                <li
                  key={chat.id}
                  className={`list-group-item d-flex align-items-center ${
                    selectedChat?.id === chat.id ? "active" : ""
                  }`}
                  onClick={() => handleSelectChat(chat)}
                >
                  <i
                    className="bi bi-person-circle text-primary me-2"
                    style={{ fontSize: "40px" }}
                  ></i>
                  <div className="flex-grow-1">
                    <strong>{chat.userDisplayName || "User"}</strong>
                    <span
                      className={`status-dot ${
                        onlineUsers.has(chat.userId) ? "online" : "offline"
                      }`}
                    ></span>
                  </div>
                  {getUnreadCount(chat) > 0 && (
                    <span className="badge bg-danger rounded-pill">
                      {getUnreadCount(chat)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {selectedChat && (
          <div className="col-md-8 col-lg-9 chat-area">
            <div className="card">
              <div className="card-header bg-primary text-white d-flex align-items-center">
                <button
                  className="btn btn-link text-white d-md-none me-2"
                  onClick={() => setSelectedChat(null)}
                >
                  <i className="bi bi-arrow-left"></i>
                </button>
                <i
                  className="bi bi-person-circle text-white me-2"
                  style={{ fontSize: "40px" }}
                ></i>
                <div>
                  {selectedChat.userDisplayName || "User"}
                  <span
                    className={`status-dot ${
                      onlineUsers.has(selectedChat.userId)
                        ? "online"
                        : "offline"
                    }`}
                  ></span>
                </div>
              </div>
              <div className="card-body chat-body">
                {isUserTyping && (
                  <div className="text-muted text-center mb-3">
                    User is typing...
                  </div>
                )}
                {selectedChat.messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`chat-message d-flex ${
                      msg.sender === "agent"
                        ? "justify-content-end"
                        : "justify-content-start"
                    } mb-3`}
                  >
                    <div className="d-flex align-items-end">
                      {msg.sender !== "agent" && (
                        <i
                          className="bi bi-person-circle text-primary me-2"
                          style={{ fontSize: "30px" }}
                        ></i>
                      )}
                      <div
                        className={`p-2 rounded ${
                          msg.sender === "agent"
                            ? "bg-success text-white"
                            : "bg-primary text-white"
                        }`}
                        style={{ maxWidth: "70%" }}
                      >
                        <strong>
                          {msg.sender === "agent"
                            ? `${msg.agentName} (${msg.agentEmail})`
                            : `${msg.userName || "User"} (${
                                msg.userEmail || selectedChat.userEmail
                              })`}
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
                      {msg.sender === "agent" && (
                        <i
                          className="bi bi-person-circle text-success ms-2"
                          style={{ fontSize: "30px" }}
                        ></i>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="card-footer">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    value={reply}
                    onChange={(e) => {
                      setReply(e.target.value);
                      handleTyping();
                    }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !isSending) handleSendMessage();
                    }}
                    placeholder="Type your reply..."
                    disabled={isSending}
                  />
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
                <div className="mt-2 input-group">
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*,application/pdf"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={handleSendMessage}
                    disabled={!file || isSending}
                  >
                    Upload File
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentDashboard;
