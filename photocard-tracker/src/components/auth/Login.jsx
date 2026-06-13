import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import ThemeAlert from '../ui/ThemeAlert';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUserProfile';

// Simple Eye Icons for Password Toggle
const EyeOpen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A08D90" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const EyeClosed = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A08D90" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

const PasswordInput = ({ value, onChange, placeholder = "Password", showPassword, onToggle }) => (
  <div style={{ position: 'relative', width: '100%' }}>
    <input
      className="login-input"
      type={showPassword ? 'text' : 'password'}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required
      style={{ paddingRight: '2.5rem' }} 
    />
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center'
      }}
      tabIndex="-1" 
    >
      {showPassword ? <EyeClosed /> : <EyeOpen />}
    </button>
  </div>
);

const AccountTypeSelector = ({ accountType, setAccountType }) => (
  <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0' }}>
    <button
      type="button"
      onClick={() => setAccountType('user')}
      style={{
        flex: 1, padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s',
        border: accountType === 'user' ? '2px solid #8D6E73' : '1px solid #D4C4C7',
        backgroundColor: accountType === 'user' ? 'rgba(141, 110, 115, 0.1)' : '#FFFFFF',
        color: accountType === 'user' ? '#8D6E73' : '#6A585B'
      }}
    >
      Collector
    </button>
    <button
      type="button"
      onClick={() => setAccountType('collaborator')}
      style={{
        flex: 1, padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s',
        border: accountType === 'collaborator' ? '2px solid #8D6E73' : '1px solid #D4C4C7',
        backgroundColor: accountType === 'collaborator' ? 'rgba(141, 110, 115, 0.1)' : '#FFFFFF',
        color: accountType === 'collaborator' ? '#8D6E73' : '#6A585B'
      }}
    >
      Collaborator
    </button>
  </div>
);

export default function Login({ user }) {
  const navigate = useNavigate();
  const { profileData } = useUserProfile(user?.uid);
  
  const [mode, setMode] = useState('login'); 
  const [email, setEmail] = useState(''); // Acts as username OR email during login
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [accountType, setAccountType] = useState('user'); 
  const [alertMsg, setAlertMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setAlertMsg('');
    setShowPassword(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAlertMsg('');
    let targetEmail = email.trim(); // Assume it's an email initially

    // If the input doesn't contain an '@', assume it's a username
    if (!targetEmail.includes('@')) {
      try {
        const cleanUsername = targetEmail.toLowerCase();
        const usernameSnap = await getDoc(doc(db, 'usernames', cleanUsername));
        
        if (usernameSnap.exists()) {
          // Username found, swap out the username for the associated email
          targetEmail = usernameSnap.data().email;
        } else {
          return setAlertMsg("Username not found.");
        }
      } catch (error) {
        console.error("Error fetching username:", error);
        return setAlertMsg("Error connecting to database.");
      }
    }

    try {
      await signInWithEmailAndPassword(auth, targetEmail, password);
      setAlertMsg("Logged in successfully!");
    } catch (error) {
      setAlertMsg("Invalid email/username or password.");
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();

    if (password !== confirmPassword) {
      return setAlertMsg("Passwords do not match.");
    }
    if (cleanUsername.length < 3) {
      return setAlertMsg("Username must be at least 3 characters long.");
    }
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      return setAlertMsg("Username can only contain lowercase letters, numbers, and underscores.");
    }

    try {
      const usernameSnap = await getDoc(doc(db, 'usernames', cleanUsername));
      if (usernameSnap.exists()) {
        return setAlertMsg("This username is already taken. Please choose another.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      const batch = writeBatch(db);
      
      batch.set(doc(db, 'usernames', cleanUsername), { 
        uid: newUser.uid,
        email: newUser.email 
      });

      batch.set(doc(db, 'profile', newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        username: cleanUsername,
        displayName: cleanUsername, 
        role: accountType,
        createdAt: new Date().toISOString()
      });

      await batch.commit();
      
      await sendEmailVerification(newUser);
      setAlertMsg("Account created successfully! A verification email has been sent to your address.");
      
    } catch (error) {
      console.error(error);
      setAlertMsg(error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      const profileSnap = await getDoc(doc(db, 'profile', googleUser.uid));
      
      if (!profileSnap.exists()) {
        const baseUsername = googleUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
        let finalUsername = baseUsername;
        let counter = 1;
        
        while ((await getDoc(doc(db, 'usernames', finalUsername))).exists()) {
          finalUsername = `${baseUsername}${counter}`;
          counter++;
        }

        const batch = writeBatch(db);
        
        batch.set(doc(db, 'usernames', finalUsername), { 
          uid: googleUser.uid,
          email: googleUser.email 
        });

        batch.set(doc(db, 'profile', googleUser.uid), {
          uid: googleUser.uid,
          email: googleUser.email,
          username: finalUsername,
          displayName: googleUser.displayName || finalUsername,
          avatarUrl: googleUser.photoURL || '/bunny.png',
          role: 'user', 
          createdAt: new Date().toISOString()
        });

        await batch.commit();
        setAlertMsg("Google account linked and profile created!");
      } else {
        setAlertMsg("Logged in with Google successfully!");
      }

    } catch (error) {
      if (error.code === 'auth/account-exists-with-different-credential') {
        setAlertMsg("An account already exists with the same email address but different sign-in credentials.");
      } else {
        setAlertMsg("Google sign-in failed. Please try again.");
      }
      console.error(error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      setAlertMsg("Error logging out.");
    }
  };

  if (user && profileData) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div style={{ width: '80px', height: '80px', margin: '0 auto 1.5rem', borderRadius: '50%', backgroundColor: '#D4C4C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={profileData.avatarUrl || '/bunny.png'} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        </div>
        <h2 style={{ color: '#312527', marginBottom: '0.5rem' }}>You are logged in</h2>
        <p style={{ color: '#8D6E73', marginBottom: '2rem' }}>as @{profileData.username || user.email}</p>
        <button onClick={handleLogout} className="login-btn-primary" style={{ maxWidth: '200px' }}>Sign Out</button>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '2rem auto 4rem', 
      padding: '2.5rem', 
      backgroundColor: '#F9F6F0', 
      borderRadius: '16px', 
      boxShadow: '0 8px 32px rgba(49, 37, 39, 0.1)',
      border: '1px solid #E6DADD'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, color: '#312527', fontSize: '1.8rem', fontWeight: '700' }}>
          {mode === 'login' ? 'Welcome Back' : 'Join the Catalog'}
        </h2>
        <p style={{ margin: '0.5rem 0 0', color: '#6A585B', fontSize: '0.9rem' }}>
          {mode === 'login' ? 'Log in to manage your collection.' : 'Create an account to start tracking.'}
        </p>
      </div>

      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg('')} />

      {mode === 'login' ? (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Changed input type to 'text' to accept usernames and updated the placeholder */}
          <input 
            className="login-input" 
            type="text" 
            placeholder="Email or Username" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
          />
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} showPassword={showPassword} onToggle={() => setShowPassword(v => !v)} />
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#8D6E73', cursor: 'pointer' }} onClick={() => setAlertMsg('Please go to your Profile settings while logged in, or contact an admin to reset your password.')}>Forgot password?</span>
          </div>

          <button type="submit" className="login-btn-primary">Log In</button>
        </form>
      ) : (
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input className="login-input" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="login-input" type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} showPassword={showPassword} onToggle={() => setShowPassword(v => !v)} />
          <PasswordInput
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            showPassword={showPassword}
            onToggle={() => setShowPassword(v => !v)}
          />
          <AccountTypeSelector accountType={accountType} setAccountType={setAccountType} />
          <button type="submit" className="login-btn-primary">Sign up</button>
        </form>
      )}

      <div className="login-divider">or</div>

      <button onClick={handleGoogleSignIn} type="button" className="login-btn-google">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" width="17" height="17" />
        Continue with Google
      </button>

      <p className="login-toggle-link" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? <>Don't have an account? <strong>Sign up</strong></> : <>Already have an account? <strong>Log in</strong></>}
      </p>
    </div>
  );
}