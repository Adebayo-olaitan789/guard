import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import FAQSection from "./components/FAQSection";
import ChatSection from "./components/ChatSection";
import AgentDashboard from "./components/AgentDashboard";

const firebaseConfig = {
  apiKey: "AIzaSyAAa7wlfdcG-kpHUe77skReRIzExreYOKI",
  authDomain: "scam-b3d6c.firebaseapp.com",
  projectId: "scam-b3d6c",
  storageBucket: "scam-b3d6c.firebasestorage.app",
  messagingSenderId: "719198491733",
  appId: "1:719198491733:web:430ef0540bfff6785af0dc",
  measurementId: "G-J3HMYDHPZZ",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const emailjsConfig = {
  serviceId: "service_0v6veum",
  templateId: "template_qqeeilm",
  userId: "23cC6xqy4YwEV7PV3",
};

// Function to set up agent emails
const setupAgentEmails = async (db) => {
  try {
    const agentDocRef = doc(db, "agents", "emails");
    await setDoc(agentDocRef, {
      emails: ["anurudeen511@gmail.com", "sandy4556789@gmail.com"],
    });
    console.log("Agent emails set up successfully.");
  } catch (error) {
    console.error("Error setting up agent emails:", error);
  }
};

// ChatIcon component for floating chat button
function ChatIcon() {
  const location = useLocation();

  return location.pathname !== "/chat" && location.pathname !== "/dashboard" ? (
    <Link
      to="/chat"
      className="btn btn-primary bg-dark text-white d-flex align-items-center position-fixed bottom-0 end-0 m-3 shadow"
      style={{
        zIndex: 1000,
        transition: "transform 0.2s",
        bottom: "80px", // Position above footer on mobile
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <i className="bi bi-chat-fill me-2"></i>
      Chat with us
    </Link>
  ) : null;
}

// Footer component for mobile navigation
function Footer({ user, isAgent }) {
  return (
    <footer
      className="d-md-none fixed-bottom bg-dark py-2"
      style={{ zIndex: 1000 }}
    >
      <div className="container">
        <ul className="nav justify-content-center">
          <li className="nav-item">
            <Link className="nav-link text-white" to="/">
              <i className="bi bi-house me-1"></i>
              Home
            </Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link text-white" to="/about">
              <i className="bi bi-info-circle me-1"></i>
              About
            </Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link text-white" to="/chat">
              <i className="bi bi-chat-fill me-1"></i>
              Chat
            </Link>
          </li>
          {user && isAgent && (
            <li className="nav-item">
              <Link className="nav-link text-white" to="/dashboard">
                <i className="bi bi-speedometer2 me-1"></i>
                Dashboard
              </Link>
            </li>
          )}
          <li className="nav-item">
            <a className="nav-link text-white" href="/terms">
              <i className="bi bi-file-text me-1"></i>
              Terms
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [isAgent, setIsAgent] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState(null);

  useEffect(() => {
    // Run this only once to set up agent emails
    setupAgentEmails(db);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setIsAuthReady(true);
        if (currentUser) {
          setUser(currentUser);
          try {
            const userDocRef = doc(db, "users", currentUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
              await setDoc(userDocRef, {
                role: "user",
                email: currentUser.email,
                displayName:
                  currentUser.displayName || currentUser.email.split("@")[0],
                lastActive: new Date().toISOString(),
              });
              setIsAgent(false);
            } else {
              await updateDoc(userDocRef, {
                lastActive: new Date().toISOString(),
              });
              setIsAgent(userDoc.data().role === "agent");
            }
          } catch (err) {
            console.error("Error checking user role:", err);
            setError("Failed to load user role. Please try again.");
          }
        } else {
          setUser(null);
          setIsAgent(false);
        }
      },
      (err) => {
        console.error("Auth state error:", err);
        setError("Authentication error. Please refresh the page.");
        setIsAuthReady(true);
      }
    );
    return () => unsubscribe();
  }, [db]);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await updateProfile(userCredential.user, { displayName });
      setError(null);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setShowAuthModal(false);
    } catch (error) {
      console.error("Registration error:", error);
      setError(
        error.message.includes("email-already-in-use")
          ? "Email already in use. Try logging in."
          : "Registration failed. Please try again."
      );
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setError(null);
      setEmail("");
      setPassword("");
      setShowAuthModal(false);
    } catch (error) {
      console.error("Login error:", error);
      setError("Login failed. Check your email or password.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setError(null);
    } catch (error) {
      console.error("Logout error:", error);
      setError("Logout failed. Please try again.");
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetMessage(null);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage("Password reset email sent. Check your inbox.");
      setResetEmail("");
      setTimeout(() => setShowResetModal(false), 3000);
    } catch (error) {
      console.error("Password reset error:", error);
      setError(
        error.code === "auth/user-not-found"
          ? "No user found with this email."
          : error.code === "auth/invalid-email"
          ? "Invalid email address."
          : "Failed to send password reset email."
      );
    }
  };

  if (!isAuthReady) {
    return (
      <div className="container mt-5 pt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="bg-dark text-white">
        <nav className="navbar navbar-expand-lg fixed-top bg-dark">
          <div className="container">
            <Link
              className="navbar-brand text-white d-flex align-items-center fs-6"
              to="/"
            >
              <img
                src="logo.png"
                alt="Scam Awareness Logo"
                className="me-2 img-fluid"
                style={{ width: "30px", height: "30px" }}
              />
              Scam Awareness
            </Link>
            <ul className="navbar-nav ms-auto d-flex flex-row flex-nowrap align-items-center">
              {user ? (
                <>
                  <li className="nav-item">
                    <span className="navbar-text mx-1 text-white fs-6">
                      Welcome, {user.displayName}
                    </span>
                  </li>
                  <li className="nav-item">
                    <button
                      className="btn btn-outline-danger px-1 mx-1 fs-6"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li className="nav-item">
                    <button
                      className="btn btn-outline-light px-1 mx-1 fs-6"
                      onClick={() => {
                        setIsRegistering(false);
                        setShowAuthModal(true);
                      }}
                    >
                      Login
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className="btn btn-primary px-1 mx-1 fs-6"
                      onClick={() => {
                        setIsRegistering(true);
                        setShowAuthModal(true);
                      }}
                    >
                      Register
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        </nav>

        {showAuthModal && !user && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content bg-dark text-white">
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">
                    {isRegistering ? "Register" : "Login"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowAuthModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={isRegistering ? handleRegister : handleLogin}>
                    {isRegistering && (
                      <div className="mb-3">
                        <label htmlFor="displayName" className="form-label">
                          Name
                        </label>
                        <input
                          type="text"
                          className="form-control bg-dark text-white"
                          id="displayName"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Enter your name"
                          required
                        />
                      </div>
                    )}
                    <div className="mb-3">
                      <label htmlFor="email" className="form-label">
                        Email
                      </label>
                      <input
                        type="email"
                        className="form-control bg-dark text-white"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label htmlFor="password" className="form-label">
                        Password
                      </label>
                      <input
                        type="password"
                        className="form-control bg-dark text-white"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary w-100">
                      {isRegistering ? "Register" : "Login"}
                    </button>
                  </form>
                  {error && (
                    <div className="alert alert-danger mt-3">{error}</div>
                  )}
                  {!isRegistering && (
                    <div className="mt-3 text-center">
                      <button
                        className="btn btn-link text-white"
                        onClick={() => setShowResetModal(true)}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-link text-white"
                    onClick={() => setIsRegistering(!isRegistering)}
                  >
                    {isRegistering ? "Switch to Login" : "Switch to Register"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showResetModal && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content bg-dark text-white">
                <div
                  className="modal-header"
                  style={{
                    backgroundColor: "#343a40",
                    color: "#fff",
                  }}
                >
                  <h5 className="modal-title">Reset Password</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetEmail("");
                      setResetMessage(null);
                      setError(null);
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handlePasswordReset}>
                    <div className="mb-3">
                      <label htmlFor="resetEmail" className="form-label">
                        Enter your email address
                      </label>
                      <input
                        type="email"
                        className="form-control bg-dark text-white"
                        id="resetEmail"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    {resetMessage && (
                      <div className="alert alert-success">{resetMessage}</div>
                    )}
                    {error && <div className="alert alert-danger">{error}</div>}
                    <button type="submit" className="btn btn-primary w-100">
                      Send Reset Email
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && user && (
          <div className="container mt-5 pt-5">
            <div className="alert alert-danger">{error}</div>
          </div>
        )}

        <ChatIcon />

        <Routes>
          <Route
            path="/"
            element={
              <div className="container mt-5 pt-5 mb-5">
                <header className="text-center py-5 parallax-bg">
                  <h1 className="display-4 fw-bold">Scam Awareness USA</h1>
                  <p className="lead">
                    Protecting you from scams with knowledge and support.
                  </p>
                </header>
                <section className="my-5">
                  <h2 className="h3 mb-4">About Us</h2>
                  <div className="row g-4">
                    <div className="col-md-6">
                      <p className="lead">
                        Scam Awareness USA is dedicated to safeguarding
                        individuals from online scams through education,
                        recovery assistance, and personalized support. Our team
                        of experts is committed to creating a safer online
                        community.
                      </p>
                    </div>
                    <div className="col-md-6">
                      <ul className="list-group">
                        <li className="list-group-item bg-dark text-white">
                          Founded in 2020
                        </li>
                        <li className="list-group-item bg-dark text-white">
                          Over 10,000 users assisted
                        </li>
                        <li className="list-group-item bg-dark text-white">
                          24/7 support team
                        </li>
                        <li className="list-group-item bg-dark text-white">
                          Nationwide coverage
                        </li>
                      </ul>
                    </div>
                  </div>
                </section>
                <section className="my-5">
                  <h2 className="h3 mb-4 text-center">What We Do</h2>
                  <div className="row g-4">
                    <div className="col-md-4">
                      <div className="card h-100 shadow-sm bg-dark text-white">
                        <div className="card-body text-center">
                          <i className="bi bi-book-fill display-4 text-primary mb-3"></i>
                          <h5 className="card-title">Education</h5>
                          <p className="card-text">
                            We provide resources, webinars, and workshops to
                            help you recognize and avoid scams.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card h-100 shadow-sm bg-dark text-white">
                        <div className="card-body text-center">
                          <i className="bi bi-shield-fill-check display-4 text-primary mb-3"></i>
                          <h5 className="card-title">Recovery Assistance</h5>
                          <p className="card-text">
                            Our team helps victims recover funds lost to scams
                            through expert guidance and legal support.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card h-100 shadow-sm bg-dark text-white">
                        <div className="card-body text-center">
                          <i className="bi bi-chat-fill display-4 text-primary mb-3"></i>
                          <h5 className="card-title">Support</h5>
                          <p className="card-text">
                            24/7 chat support with trained agents to answer your
                            questions and provide real-time assistance.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
                <section className="my-5">
                  <h2 className="h3 mb-4">Stay Informed</h2>
                  <div className="row justify-content-center">
                    <div className="col-md-6">
                      <video
                        controls
                        className="w-100 rounded shadow"
                        src="vide.mp4"
                      >
                        <source src="vide.mp4" type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                      <p className="mt-2 text-center">
                        A 15-second AI-generated warning about online scams.
                        (Use tools like Google’s Veo 3 or Magnifi to create.)
                      </p>
                    </div>
                  </div>
                </section>
                <section className="my-5">
                  <h2 className="h3 mb-4 text-center">Testimonials</h2>
                  <div
                    id="testimonialCarousel"
                    className="carousel slide"
                    data-bs-ride="carousel"
                    data-bs-interval="5000"
                  >
                    <div className="carousel-inner">
                      {[
                        {
                          name: "John Smith",
                          text: "Scam Awareness USA helped me recover $5,000 lost to a phishing scam. Their team was incredible!",
                        },
                        {
                          name: "Emily Johnson",
                          text: "Thanks to their guidance, I avoided a major scam. Highly recommend their services!",
                        },
                        {
                          name: "Michael Brown",
                          text: "Their 24/7 support saved me from a fraudulent investment scheme. Thank you!",
                        },
                        {
                          name: "Sarah Davis",
                          text: "I learned how to spot scams through their workshops. Very informative!",
                        },
                        {
                          name: "David Wilson",
                          text: "Recovered my funds in just two weeks with their expert help!",
                        },
                        {
                          name: "Lisa Taylor",
                          text: "Their quick response and support were lifesavers. I’m so grateful!",
                        },
                        {
                          name: "James Anderson",
                          text: "Scam Awareness USA educated me on online safety. Top-notch service!",
                        },
                        {
                          name: "Patricia Martinez",
                          text: "Their team was professional and helped me recover my money quickly!",
                        },
                        {
                          name: "Robert Thomas",
                          text: "I was skeptical, but they proved me wrong with their amazing support!",
                        },
                        {
                          name: "Jennifer Lee",
                          text: "Their chat support is fantastic. They answered all my questions promptly!",
                        },
                      ].map((testimonial, index) => (
                        <div
                          key={index}
                          className={`carousel-item ${
                            index === 0 ? "active" : ""
                          }`}
                        >
                          <div className="card text-center border-0 shadow-sm mx-auto testimonial-card">
                            <div className="card-body bg-dark text-white">
                              <h5 className="card-title">{testimonial.name}</h5>
                              <p className="card-text">{testimonial.text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="carousel-control-prev"
                      type="button"
                      data-bs-target="#testimonialCarousel"
                      data-bs-slide="prev"
                    >
                      <span
                        className="carousel-control-prev-icon bg-dark"
                        aria-hidden="true"
                      ></span>
                      <span className="visually-hidden">Previous</span>
                    </button>
                    <button
                      className="carousel-control-next"
                      type="button"
                      data-bs-target="#testimonialCarousel"
                      data-bs-slide="next"
                    >
                      <span
                        className="carousel-control-next-icon bg-dark"
                        aria-hidden="true"
                      ></span>
                      <span className="visually-hidden">Next</span>
                    </button>
                  </div>
                </section>
                <FAQSection />
              </div>
            }
          />
          <Route
            path="/about"
            element={
              <div className="container mt-5 pt-5 mb-5">
                <h1 className="h2 mb-4">About Us</h1>
                <div className="row g-4">
                  <div className="col-md-6">
                    <h3>Our Mission</h3>
                    <p className="lead">
                      To empower individuals with the knowledge and tools to
                      protect themselves from online scams and fraud.
                    </p>
                  </div>
                  <div className="col-md-6">
                    <h3>Our Team</h3>
                    <p>
                      Our team consists of cybersecurity experts, financial
                      advisors, and dedicated support agents working together to
                      ensure your safety.
                    </p>
                  </div>
                  <div className="col-12">
                    <h3>Our Achievements</h3>
                    <ul className="list-group">
                      <li className="list-group-item bg-dark text-white">
                        Helped over 10,000 victims recover funds
                      </li>
                      <li className="list-group-item bg-dark text-white">
                        Conducted 500+ workshops nationwide
                      </li>
                      <li className="list-group-item bg-dark text-white">
                        24/7 support with 98% satisfaction rate
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            }
          />
          <Route
            path="/chat"
            element={
              <div className="container mt-5 pt-5 mb-5">
                <ChatSection
                  user={user}
                  db={db}
                  storage={storage}
                  emailjsConfig={emailjsConfig}
                />
              </div>
            }
          />
          <Route
            path="/dashboard"
            element={
              isAgent ? (
                <div className="container-fluid mt-5 pt-5 mb-5">
                  <AgentDashboard
                    user={user}
                    db={db}
                    storage={storage}
                    emailjsConfig={emailjsConfig}
                  />
                </div>
              ) : (
                <div className="container mt-5 pt-5 mb-5">
                  <div className="alert alert-danger">
                    You do not have permission to access the Agent Dashboard.
                  </div>
                </div>
              )
            }
          />
        </Routes>

        <Footer user={user} isAgent={isAgent} />
      </div>
    </Router>
  );
}

export default App;
