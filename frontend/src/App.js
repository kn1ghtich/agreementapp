import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import CreateDocument from './pages/CreateDocument';
import MyDocuments from './pages/MyDocuments';
import Chat from './pages/Chat';
import './App.css';

const AppLayout = ({ children }) => {
  return (
    <>
      <Navbar />
      <main className="main-content">{children}</main>
    </>
  );
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Загрузка...</div>;
  return user ? <Navigate to="/" /> : children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

          <Route path="/" element={<PrivateRoute><AppLayout><Home /></AppLayout></PrivateRoute>} />
          <Route path="/calendar" element={<PrivateRoute><AppLayout><Calendar /></AppLayout></PrivateRoute>} />
          <Route path="/create" element={<PrivateRoute><AppLayout><CreateDocument /></AppLayout></PrivateRoute>} />
          <Route path="/my-documents" element={<PrivateRoute><AppLayout><MyDocuments /></AppLayout></PrivateRoute>} />
          <Route path="/chat" element={<PrivateRoute><AppLayout><Chat /></AppLayout></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><AppLayout><Profile /></AppLayout></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
