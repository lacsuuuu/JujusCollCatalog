import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential
} from 'firebase/auth';
import { doc, getDoc, writeBatch, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import ThemeAlert from '../ui/ThemeAlert';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUserProfile';

const LOGIN_STYLES = `
  .login-input {
    padding: 0.65rem 1rem;
    border-radius: 6px;
    border: 1px solid #D4C4C7;
    background-color: #FFFFFF;
    color: #312527;
    font-size: 0.9rem;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .login-input:focus {
    border-color: #8D6E73;
    box-shadow: 0 0 0 3px rgba(141, 110, 115, 0.15);
  }
  .login-input::placeholder { color: #A89396; }

  .login-btn-primary {
    margin-top: 0.25rem;
    padding: 0.7rem;
    background-color: #8D6E73;
    color: #FFFFFF;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    width: 100%;
    letter-spacing: 0.03em;
    transition: background-color 0.2s ease, transform 0.1s ease;
  }
  .login-btn-primary:hover { background-color: #7A5F64; }
  .login-btn-primary:active { transform: scale(0.98); }

  .login-btn-google {
    padding: 0.7rem;
    background-color: #FFFFFF;
    color: #312527;
    border: 1px solid #D4C4C7;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }
  .login-btn-google:hover { background-color: #F9F3F4; border-color: #C2B0B4; }

  .login-eye-btn {
    position: absolute;
    right: 0.75rem;
    top: 0; bottom: 0;
    display: flex;
    align-items: center;
    cursor: pointer;
    color: #8D6E73;
    user-select: none;
    background: none;
    border: none;
    padding: 0 0.1rem;
    transition: color 0.2s ease;
  }
  .login-eye-btn:hover { color: #6B5458; }

  .login-toggle-link {
    text-align: center;
    font-size: 0.82rem;
    color: #6A585B;
    margin-top: 1.25rem;
    cursor: pointer;
    transition: color 0.2s ease;
  }
  .login-toggle-link:hover { color: #8D6E73; }
  .login-toggle-link span { color: #8D6E73; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }

  .login-divider {
    display: flex;
    align-items: center;
    margin: 1.25rem 0;
    gap: 10px;
    color: #A89396;
    font-size: 0.8rem;
  }
  .login-divider::before,
  .login-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: #E8DFE0;
  }

  .login-radio-group {
    display: flex;
    gap: 1rem;
    margin: 0.25rem 0;
  }
  .login-radio-label {
    font-size: 0.85rem;
    color: #6A585B;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
  }
  .login-radio-label input[type="radio"] { accent-color: #8D6E73; cursor: pointer; }

  .login-card {
    max-width: 380px;
    width: 100%;
    margin: 3rem auto;
    padding: 2rem 2rem 1.75rem;
    background-color: #FFFFFF;
    border-radius: 12px;
    border: 1px solid #D4C4C7;
    box-shadow: 0 2px 12px rgba(49, 37, 39, 0.08);
  }

  .login-heading {
    margin: 0 0 0.35rem 0;
    text-align: center;
    font-size: 1.15rem;
    font-weight: 700;
    color: #312527;
    letter-spacing: 0.02em;
  }
  .login-subheading {
    margin: 0 0 1.5rem 0;
    text-align: center;
    font-size: 0.8rem;
    color: #A89396;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* ── Toggle switch ── */
  .collab-toggle {
    position: relative;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
  }
  .collab-toggle input { opacity: 0; width: 0; height: 0; }
  .collab-toggle-slider {
    position: absolute;
    inset: 0;
    background-color: #D4C4C7;
    border-radius: 20px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .collab-toggle-slider::before {
    content: '';
    position: absolute;
    width: 14px; height: 14px;
    left: 3px; top: 3px;
    background-color: #FFFFFF;
    border-radius: 50%;
    transition: transform 0.2s ease;
  }
  .collab-toggle input:checked + .collab-toggle-slider { background-color: #8D6E73; }
  .collab-toggle input:checked + .collab-toggle-slider::before { transform: translateX(16px); }

  /* ── Admin modal ── */
  .admin-modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(49, 37, 39, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .admin-modal {
    background-color: #FFFFFF;
    border-radius: 14px;
    border: 1px solid #D4C4C7;
    box-shadow: 0 8px 30px rgba(49, 37, 39, 0.18);
    width: 100%;
    max-width: 460px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .admin-modal-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #F0E8EA;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .admin-modal-body {
    overflow-y: auto;
    padding: 1rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .admin-modal-body::-webkit-scrollbar { width: 6px; }
  .admin-modal-body::-webkit-scrollbar-track { background: transparent; }
  .admin-modal-body::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 4px; }
  .admin-user-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.75rem;
    border-radius: 8px;
    background-color: #FAF6F7;
    border: 1px solid #EDE4E6;
  }
  .admin-section-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #A89396;
    margin: 0.5rem 0 0.25rem 0;
  }
  .admin-close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #A89396;
    display: flex;
    align-items: center;
    padding: 0.2rem;
    border-radius: 4px;
    transition: color 0.2s;
  }
  .admin-close-btn:hover { color: #312527; }
`;

// ─── Icons ────────────────────────────────────────────────────────────────────
const EyeOpenIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosedIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ─── Sub-components ───────────────────────────────────────────────────────────
const AccountTypeSelector = ({ accountType, setAccountType }) => (
  <div className="login-radio-group">
    <label className="login-radio-label">
      <input type="radio" name="accountType" value="user" checked={accountType === 'user'} onChange={e => setAccountType(e.target.value)} />
      Standard User
    </label>
    <label className="login-radio-label">
      <input type="radio" name="accountType" value="collaborator" checked={accountType === 'collaborator'} onChange={e => setAccountType(e.target.value)} />
      Collaborator
    </label>
  </div>
);

const PasswordInput = ({ value, onChange, placeholder = 'Password', showPassword, onToggle }) => (
  <div style={{ position: 'relative', width: '100%' }}>
    <input
      className="login-input"
      style={{ paddingRight: '2.5rem' }}
      type={showPassword ? 'text' : 'password'}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required
    />
    <button type="button" className="login-eye-btn" onClick={onToggle} aria-label={showPassword ? 'Hide password' : 'Show password'}>
      {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
    </button>
  </div>
);

// ─── Admin Modal ──────────────────────────────────────────────────────────────
function AdminModal({ onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(query(
        collection(db, 'profile'),
        where('role', 'in', ['pending_collaborator', 'collaborator'])
      ));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetch();
  }, []);

  const toggleCollaborator = async (userId, currentRole) => {
    const newRole = currentRole === 'collaborator' ? 'user' : 'collaborator';
    setProcessing(userId);
    await updateDoc(doc(db, 'profile', userId), { role: newRole });
    setUsers(prev => prev
      .map(u => u.id === userId ? { ...u, role: newRole } : u)
      .filter(u => u.role !== 'user') // remove from list once revoked
    );
    setProcessing(null);
  };

  const pending = users.filter(u => u.role === 'pending_collaborator');
  const approved = users.filter(u => u.role === 'collaborator');

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={e => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#312527' }}>Collaborators</h3>
            <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.78rem', color: '#A89396' }}>Toggle to approve or revoke access</p>
          </div>
          <button className="admin-close-btn" onClick={onClose} style={{ alignSelf: 'flex-start', marginTop: '0.1rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="admin-modal-body">
          {loading ? (
            <p style={{ color: '#A89396', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>Loading...</p>
          ) : (
            <>
              {/* Pending */}
              {pending.length > 0 && (
                <>
                  <p className="admin-section-label">
                    Pending requests
                    <span style={{ marginLeft: '0.4rem', backgroundColor: '#A85A66', color: '#FFF', borderRadius: '10px', padding: '0.1rem 0.4rem', fontSize: '0.68rem' }}>
                      {pending.length}
                    </span>
                  </p>
                  {pending.map(u => (
                    <UserRow key={u.id} u={u} processing={processing} onToggle={toggleCollaborator} />
                  ))}
                </>
              )}

              {/* Approved */}
              {approved.length > 0 && (
                <>
                  <p className="admin-section-label" style={{ marginTop: pending.length > 0 ? '0.75rem' : 0 }}>
                    Active collaborators
                  </p>
                  {approved.map(u => (
                    <UserRow key={u.id} u={u} processing={processing} onToggle={toggleCollaborator} />
                  ))}
                </>
              )}

              {pending.length === 0 && approved.length === 0 && (
                <p style={{ color: '#A89396', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                  No pending or active collaborators.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UserRow({ u, processing, onToggle }) {
  const isCollaborator = u.role === 'collaborator';
  return (
    <div className="admin-user-row">
      <img
        src={u.avatarUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23C2B0B4'/%3E%3C/svg%3E"}
        alt={u.name}
        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #E6DADD', flexShrink: 0 }}
        onError={e => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23C2B0B4'/%3E%3C/svg%3E"; }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: '700', fontSize: '0.88rem', color: '#312527', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {u.name || u.username || 'Unnamed'}
        </p>
        {u.username && (
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#8D6E73' }}>@{u.username}</p>
        )}
      </div>
      <label className="collab-toggle" title={isCollaborator ? 'Revoke collaborator' : 'Approve as collaborator'}>
        <input
          type="checkbox"
          checked={isCollaborator}
          disabled={processing === u.id}
          onChange={() => onToggle(u.id, u.role)}
        />
        <span className="collab-toggle-slider" />
      </label>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Login() {
  const { currentUser, loading } = useAuth();
  const { profileData } = useUserProfile(currentUser?.uid);
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [alertMsg, setAlertMsg] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountType, setAccountType] = useState('user');
  const [googleUser, setGoogleUser] = useState(null);

  if (loading) return null;

  const checkUsernameAvailable = async (requestedUsername) => {
    const snap = await getDoc(doc(db, 'usernames', requestedUsername.toLowerCase()));
    return !snap.exists();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      let loginEmail = identifier;
      if (!identifier.includes('@')) {
        const usernameSnap = await getDoc(doc(db, 'usernames', identifier.toLowerCase()));
        loginEmail = usernameSnap.exists() ? usernameSnap.data().email : `${identifier}@admin.local`;
      }
      const cred = await signInWithEmailAndPassword(auth, loginEmail, password);
      const profileSnap = await getDoc(doc(db, 'profile', cred.user.uid));
      const uname = profileSnap.exists() ? profileSnap.data().username : null;
      navigate(uname ? `/profile/${uname}` : '/feed');
    } catch {
      setAlertMsg('Invalid credentials.');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) return setAlertMsg('Passwords do not match.');
    if (username.length < 3) return setAlertMsg('Username must be at least 3 characters.');
    if (username.includes('@') || username.includes(' ')) return setAlertMsg('Username cannot contain spaces or @ symbols.');
    if (!(await checkUsernameAvailable(username))) return setAlertMsg('Username is already taken. Please choose another.');

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      const batch = writeBatch(db);
      batch.set(doc(db, 'usernames', username.toLowerCase()), { uid: cred.user.uid, email: email.toLowerCase() });
      batch.set(doc(db, 'profile', cred.user.uid), {
        username, name: username, email,
        role: accountType === 'collaborator' ? 'pending_collaborator' : 'user',
        createdAt: new Date()
      });
      await batch.commit();
      setAlertMsg('Account created! Please check your email to verify.');
    } catch (error) {
      setAlertMsg(error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());

      // Store pending user data before any async Firestore call,
      // so we have it available even if the read fails for a new account.
      const pendingUser = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        credential: GoogleAuthProvider.credentialFromResult(result),
      };

      let hasProfile = false;
      let profileUsername = null;
      try {
        const profileSnap = await getDoc(doc(db, 'profile', result.user.uid));
        if (profileSnap.exists() && profileSnap.data().username) {
          hasProfile = true;
          profileUsername = profileSnap.data().username;
        }
      } catch (firestoreError) {
        // A permissions error here means the profile doesn't exist yet
        // (Firestore rules deny reads for documents that don't belong to the user).
        // Treat this the same as "no profile found" and proceed to setup.
        if (firestoreError.code !== 'permission-denied') {
          throw firestoreError; // re-throw unexpected errors
        }
      }

      if (hasProfile) {
        navigate(`/profile/${profileUsername}`);
      } else {
        // No profile yet — go to setup. Keep the user signed in so Firestore writes succeed.
        setGoogleUser(pendingUser);
        setMode('google-setup');
      }
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') return;
      setAlertMsg(error.message);
    }
  };

  const handleGoogleUsernameSubmit = async (e) => {
    e.preventDefault();
    if (username.length < 3) return setAlertMsg('Username must be at least 3 characters.');
    if (username.includes('@') || username.includes(' ')) return setAlertMsg('Username cannot contain spaces or @ symbols.');
    if (!(await checkUsernameAvailable(username))) return setAlertMsg('Username is already taken.');

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'usernames', username.toLowerCase()), { uid: googleUser.uid, email: googleUser.email });
      batch.set(doc(db, 'profile', googleUser.uid), {
        username, name: googleUser.displayName || username, displayName: googleUser.displayName || username,
        email: googleUser.email,
        role: accountType === 'collaborator' ? 'pending_collaborator' : 'user',
        createdAt: new Date()
      });
      await batch.commit();
      navigate(`/profile/${username}`);
    } catch (error) {
      setAlertMsg(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setMode('login');
  };

  const switchMode = (next) => {
    setMode(next);
    setAlertMsg(null);
    setShowPassword(false);
  };

  // ── Logged-in state ──────────────────────────────────────────────────────
  if (currentUser && mode !== 'google-setup' && !googleUser) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#312527' }}>
        <style>{LOGIN_STYLES}</style>
        <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />

        {showAdminModal && <AdminModal onClose={() => setShowAdminModal(false)} />}

        <p style={{ marginBottom: '0.25rem', fontSize: '0.9rem', color: '#6A585B' }}>You're logged in.</p>
        {!currentUser.emailVerified && !currentUser.email.includes('@admin.local') && (
          <p style={{ color: '#A85A66', fontSize: '0.82rem', marginBottom: '1rem', fontWeight: '600' }}>
            Please verify your email address to access all features.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', marginTop: '1rem' }}>
          {profileData?.role === 'admin' && (
            <button
              onClick={() => setShowAdminModal(true)}
              style={{ padding: '0.55rem 2rem', backgroundColor: '#8D6E73', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
            >
              ⚙ Manage Collaborators
            </button>
          )}
          <button
            onClick={handleLogout}
            style={{ padding: '0.55rem 2rem', backgroundColor: 'transparent', color: '#8D6E73', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  // ── Google setup ──────────────────────────────────────────────────────────
  if (mode === 'google-setup') {
    return (
      <div className="login-card">
        <style>{LOGIN_STYLES}</style>
        <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
        <h2 className="login-heading">Almost there</h2>
        <p className="login-subheading">Choose a username</p>
        <form onSubmit={handleGoogleUsernameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <input className="login-input" type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
          <AccountTypeSelector accountType={accountType} setAccountType={setAccountType} />
          <button type="submit" className="login-btn-primary">Complete setup</button>
        </form>
      </div>
    );
  }

  // ── Login / Signup ─────────────────────────────────────────────────────────
  return (
    <div className="login-card">
      <style>{LOGIN_STYLES}</style>
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />

      <h2 className="login-heading">{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
      <p className="login-subheading">{mode === 'login' ? 'Sign in to continue' : 'Join the community'}</p>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <input className="login-input" type="text" placeholder="Email or username" value={identifier} onChange={e => setIdentifier(e.target.value)} required />
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} showPassword={showPassword} onToggle={() => setShowPassword(v => !v)} />
          <button type="submit" className="login-btn-primary">Log in</button>
        </form>
      ) : (
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
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
        {mode === 'login' ? <>Don't have an account? <span>Sign up</span></> : <>Already have an account? <span>Log in</span></>}
      </p>
    </div>
  );
}