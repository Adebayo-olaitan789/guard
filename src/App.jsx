import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
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

function App() {
  const [user, setUser] = useState(null);
  const [isAgent, setIsAgent] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              role: "user", // Default to user, admin must update to 'agent'
              email: currentUser.email,
              displayName: currentUser.displayName,
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

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <Router>
      <div className={theme === "light" ? "bg-light" : "bg-dark text-white"}>
        <nav
          className={`navbar navbar-expand-lg fixed-top ${
            theme === "light" ? "bg-light" : "bg-dark"
          }`}
        >
          <div className="container">
            <Link className="navbar-brand" to="/">
              Scam Awareness USA
            </Link>
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarNav"
              aria-controls="navbarNav"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarNav">
              <ul className="navbar-nav ms-auto">
                <li className="nav-item">
                  <Link className="nav-link" to="/">
                    Home
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/about">
                    About Us
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/chat">
                    <i className="bi bi-chat-fill me-1"></i> Chat
                  </Link>
                </li>
                {user && isAgent && (
                  <li className="nav-item">
                    <Link className="nav-link" to="/dashboard">
                      Dashboard
                    </Link>
                  </li>
                )}
                <li className="nav-item">
                  <button
                    className={`btn btn-outline-${
                      theme === "light" ? "dark" : "light"
                    } mx-2`}
                    onClick={toggleTheme}
                  >
                    {theme === "light" ? "Dark Mode" : "Light Mode"}
                  </button>
                </li>
                {user ? (
                  <>
                    <li className="nav-item">
                      <span className="navbar-text mx-2">
                        Welcome, {user.displayName}
                      </span>
                    </li>
                    <li className="nav-item">
                      <button
                        className="btn btn-outline-danger"
                        onClick={handleLogout}
                      >
                        Logout
                      </button>
                    </li>
                  </>
                ) : (
                  <li className="nav-item">
                    <button
                      className="btn btn-primary"
                      onClick={handleGoogleLogin}
                    >
                      Login with Gmail
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </nav>
        {error && (
          <div className="container mt-5">
            <div className="alert alert-danger">{error}</div>
          </div>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <div className="container mt-5">
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
                        <li className="list-group-item">Founded in 2020</li>
                        <li className="list-group-item">
                          Over 10,000 users assisted
                        </li>
                        <li className="list-group-item">24/7 support team</li>
                        <li className="list-group-item">Nationwide coverage</li>
                      </ul>
                    </div>
                  </div>
                </section>
                <section className="my-5">
                  <h2 className="h3 mb-4 text-center">What We Do</h2>
                  <div className="row g-4">
                    <div className="col-md-4">
                      <div className="card h-100 shadow-sm">
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
                      <div className="card h-100 shadow-sm">
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
                      <div className="card h-100 shadow-sm">
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
                        src="https://via.placeholder.com/15s-video.mp4"
                      >
                        <source
                          src="https://via.placeholder.com/15s-video.mp4"
                          type="video/mp4"
                        />
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
                            <div className="card-body">
                              <h5 className="card-title text-teal">
                                {testimonial.name}
                              </h5>
                              <p className="card-text text-muted">
                                {testimonial.text}
                              </p>
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
                        className="carousel-control-prev-icon bg-teal"
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
                        className="carousel-control-next-icon bg-teal"
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
            path="/chat"
            element={
              <div className="container mt-5">
                <ChatSection
                  user={user}
                  db={db}
                  emailjsConfig={emailjsConfig}
                />
              </div>
            }
          />
          <Route
            path="/dashboard"
            element={
              isAgent ? (
                <div className="container-fluid mt-5">
                  <AgentDashboard
                    user={user}
                    db={db}
                    storage={storage}
                    emailjsConfig={emailjsConfig}
                  />
                </div>
              ) : (
                <div className="container mt-5">
                  <div className="alert alert-danger">
                    You do not have permission to access the Agent Dashboard.
                  </div>
                </div>
              )
            }
          />
          <Route
            path="/about"
            element={
              <div className="container mt-5">
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
                      <li className="list-group-item">
                        Helped over 10,000 victims recover funds
                      </li>
                      <li className="list-group-item">
                        Conducted 500+ workshops nationwide
                      </li>
                      <li className="list-group-item">
                        24/7 support with 98% satisfaction rate
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
