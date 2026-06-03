import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import ThemeAlert from '../ui/ThemeAlert';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  // Move these inside the component or ensure they are imported/defined above it
  const inputStyle = {
    padding: '0.7rem 1rem',
    borderRadius: '6px',
    border: '1px solid #D4C4C7',
    backgroundColor: '#FFFFFF',
    color: '#312527',
    fontSize: '0.95rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const eyeIconStyle = {
    position: 'absolute',
    right: '0.75rem',
    top: '0',
    bottom: '0',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    color: '#8D6E73',
    userSelect: 'none',
    padding: '0 0.1rem',
  };

  const { currentUser, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const navigate = useNavigate();

  if (loading) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    const formattedEmail = username.includes('@') ? username : `${username}@admin.local`;
    try {
      await signInWithEmailAndPassword(auth, formattedEmail, password);
      navigate('/');
    } catch (error) {
      setAlertMsg("Invalid credentials.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // If currentUser exists, show the Logout screen
  if (currentUser) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#312527' }}>
        <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
        <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>Logged in successfully</p>
        <button
          onClick={handleLogout}
          style={{ padding: '0.6rem 2rem', backgroundColor: 'transparent', color: '#8D6E73', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Log Out
        </button>
      </div>
    );
  }

  // If no currentUser, show the Login Form
  return (
    <div style={{ maxWidth: '360px', width: '100%', margin: '3rem auto', padding: '2rem', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #D4C4C7', boxShadow: '0 2px 8px rgba(49, 37, 39, 0.08)' }}>
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
      <h2 style={{ margin: '0 0 1.5rem 0', textAlign: 'center', fontSize: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527' }}>Admin Access</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input style={inputStyle} type="text" placeholder="Username or Email" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <div style={{ position: 'relative', width: '100%' }}>
          <input style={{ ...inputStyle, paddingRight: '2.5rem' }} type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {/* ... eye icon code ... */}
        </div>
        <button type="submit" style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#8D6E73', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Log In</button>
      </form>
    </div>
  );
}