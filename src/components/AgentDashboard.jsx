import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
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

  useEffect(() => {
    const q = query(collection(db, "chats"), where("isHuman", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("Fetched Chats:", chatData);
      // Ensure unique users by userId
      const uniqueChats = [];
      const seenUserIds = new Set();
      for (const chat of chatData) {
        if (!seenUserIds.has(chat.userId)) {
          seenUserIds.add(chat.userId);
          uniqueChats.push(chat);
        }
      }
      setChats(uniqueChats);
    });

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
  }, [db, chats]);

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setReply("");
    setFile(null);
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !reply.trim()) return;

    try {
      const chatRef = doc(db, "chats", selectedChat.id);
      const updatedMessages = [
        ...selectedChat.messages,
        {
          sender: "agent",
          text: reply,
          timestamp: new Date().toISOString(),
          agentName: user.displayName,
          agentEmail: user.email,
        },
      ];
      console.log("Updating chat:", {
        chatId: selectedChat.id,
        userId: selectedChat.userId,
        messages: updatedMessages,
      });
      await updateDoc(chatRef, { messages: updatedMessages });

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
              message: `New agent reply from ${user.displayName} (${user.email}) to ${selectedChat.userDisplayName}: ${reply}`,
            },
            emailjsConfig.userId
          );
        }
      }

      setReply("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleFileUpload = async () => {
    if (!file || !selectedChat) return;

    try {
      const storageRef = ref(
        storage,
        `chat_files/${selectedChat.id}/${file.name}`
      );
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      const chatRef = doc(db, "chats", selectedChat.id);
      const updatedMessages = [
        ...selectedChat.messages,
        {
          sender: "agent",
          text: `File uploaded: ${file.name}`,
          fileUrl,
          timestamp: new Date().toISOString(),
          agentName: user.displayName,
          agentEmail: user.email,
        },
      ];
      console.log("Uploading file:", {
        chatId: selectedChat.id,
        userId: selectedChat.userId,
        messages: updatedMessages,
      });
      await updateDoc(chatRef, { messages: updatedMessages });

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
              message: `New file uploaded by ${user.displayName} (${user.email}) to ${selectedChat.userDisplayName}: ${file.name}`,
            },
            emailjsConfig.userId
          );
        }
      }

      setFile(null);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  return (
    <div className="agent-dashboard container-fluid">
      <div className="row h-100">
        <div
          className={`col-md-4 col-lg-3 chat-list ${
            selectedChat ? "d-none d-md-block" : "d-block"
          }`}
        >
          <div className="card">
            <div className="card-header bg-primary text-white">
              Active Chats
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
                  <div>
                    <strong>{chat.userDisplayName || "User"}</strong>
                    <div className="small">{chat.userEmail}</div>
                    <span
                      className={`status-dot ${
                        onlineUsers.has(chat.userId) ? "online" : "offline"
                      }`}
                    ></span>
                  </div>
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
                  <div className="small">{selectedChat.userEmail}</div>
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
                {selectedChat.messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`chat-message d-flex ${
                      msg.sender === "agent"
                        ? "justify-content-end"
                        : "justify-content-start"
                    } mb-2`}
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
                        <div className="small text-light opacity-75">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                        {msg.fileUrl && (
                          <div>
                            <a
                              href={msg.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View File
                            </a>
                          </div>
                        )}
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
              </div>
              <div className="card-footer">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your reply..."
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleSendMessage}
                  >
                    Send
                  </button>
                </div>
                <div className="mt-2">
                  <input
                    type="file"
                    className="form-control"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  <button
                    className="btn btn-secondary mt-2"
                    onClick={handleFileUpload}
                    disabled={!file}
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
