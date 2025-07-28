import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import "bootstrap/dist/css/bootstrap.min.css";
import FAQSection from "./components/FAQSection";
import ChatSection from "./components/ChatSection";
import AgentDashboard from "./components/AgentDashboard";

// Firebase configuration (use .env for security)
const firebaseConfig = {
  apiKey: "AIzaSyAAa7wlfdcG-kpHUe77skReRIzExreYOKI",
  authDomain: "scam-b3d6c.firebaseapp.com",
  projectId: "scam-b3d6c",
  storageBucket: "scam-b3d6c.firebasestorage.app",
  messagingSenderId: "719198491733",
  appId: "1:719198491733:web:430ef0540bfff6785af0dc",
  measurementId: "G-J3HMYDHPZZ",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// EmailJS configuration
const emailjsConfig = {
  serviceId: "service_0v6veum",
  templateId: "template_qqeeilm",
  userId: "23cC6xqy4YwEV7PV3",
};

function App() {
  const [user, setUser] = useState(null);
  const [isAgent, setIsAgent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        console.log("User UID:", currentUser.uid); // Debug UID
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          const isAgent = userDoc.exists() && userDoc.data().role === "agent";
          console.log("Is Agent:", isAgent, "User Data:", userDoc.data()); // Debug role
          setIsAgent(isAgent);
          if (!isAgent && userDoc.exists()) {
            setError(
              "You do not have permission to access the Agent Dashboard."
            );
          }
        } catch (err) {
          console.error("Error checking user role:", err);
          setError("Failed to verify user role. Please try again.");
        }
      } else {
        setUser(null);
        setIsAgent(false);
      }
    });
    return () => unsubscribe();
  }, [db]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/gmail.send");
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.warn("Login error (ignoring COOP warning):", error.message);
      setError("Login failed. Please try again.");
    }
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => {
      console.error("Logout error:", error);
      setError("Logout failed. Please try again.");
    });
  };

  return (
    <div className="container-fluid">
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <div className="container">
          <a className="navbar-brand" href="#">
            Scam Awareness USA
          </a>
          <div className="ms-auto">
            {user ? (
              <>
                <span className="navbar-text me-2">
                  Welcome, {user.displayName}
                </span>
                <button
                  className="btn btn-outline-danger"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={handleGoogleLogin}>
                Login with Gmail
              </button>
            )}
          </div>
        </div>
      </nav>
      {error && <div className="alert alert-danger mt-3">{error}</div>}
      <div className="row mt-4">
        {user && isAgent ? (
          <div className="col-md-6">
            <AgentDashboard
              user={user}
              db={db}
              storage={storage}
              emailjsConfig={emailjsConfig}
            />
          </div>
        ) : null}
        <div className={user && isAgent ? "col-md-6" : "col-md-12"}>
          <h1 className="text-center">Scam Awareness USA</h1>
          <p className="text-center lead">
            Learn how to protect yourself from scams in the USA.
          </p>
          <FAQSection />
          <ChatSection user={user} db={db} emailjsConfig={emailjsConfig} />
        </div>
      </div>
    </div>
  );
}

export default App;
