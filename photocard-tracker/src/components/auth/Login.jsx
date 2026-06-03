import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import ThemeAlert from '../ui/ThemeAlert';

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

export default function Login({ user }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const navigate = useNavigate();

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
    // No alert here — user is already leaving the logged-in view
  };

  if (user) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#312527' }}>
        <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
        <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>Logged in successfully</p>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.6rem 2rem',
            backgroundColor: 'transparent',
            color: '#8D6E73',
            border: '1px solid #8D6E73',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            transition: 'all 0.2s',
          }}
        >
          Log Out
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '360px', width: '100%', margin: '3rem auto', padding: '2rem', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #D4C4C7', boxShadow: '0 2px 8px rgba(49, 37, 39, 0.08)' }}>
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
      <h2 style={{ margin: '0 0 1.5rem 0', textAlign: 'center', fontSize: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527' }}>Admin Access</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input
          style={inputStyle}
          type="text"
          placeholder="Username or Email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        {/* Password field with show/hide toggle */}
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            style={{ ...inputStyle, paddingRight: '2.5rem' }}
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span
            style={eyeIconStyle}
            onClick={() => setShowPassword((prev) => !prev)}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              // Soft eye-off: slash through a rounded eye
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c5 0 9 4.5 9 7a8.19 8.19 0 0 1-1.72 3.2"/>
                <path d="M6.52 6.52A9.91 9.91 0 0 0 3 12c0 2.5 4 7 9 7a9.58 9.58 0 0 0 5.48-1.73"/>
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                <line x1="3" y1="3" x2="21" y2="21"/>
              </svg>
            ) : (
              // Soft open eye with filled pupil dot
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12c0-2.5 4-7 9-7s9 4.5 9 7-4 7-9 7-9-4.5-9-7z"/>
                <circle cx="12" cy="12" r="2.5" fill="#8D6E73" stroke="none"/>
              </svg>
            )}
          </span>
        </div>

        <button
          type="submit"
          style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#8D6E73', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'background-color 0.2s' }}
        >
          Log In
        </button>
      </form>
    </div>
  );
}