import { lazy, Suspense } from 'react';
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from './context/AuthContext';
import BinderPage from './components/merch/BinderPage';
import { useUserProfile } from './hooks/useUserProfile';
import Footer from './components/ui/Footer';

const Profile = lazy(() => import('./components/user/Profile.jsx'));
const AddMerch = lazy(() => import('./components/merch/AddMerch.jsx'));
const MerchGallery = lazy(() => import('./components/merch/MerchGallery.jsx'));
const AddPost = lazy(() => import('./components/feed/AddPost.jsx'));
const Feed = lazy(() => import('./components/feed/Feed.jsx'));
const Login = lazy(() => import('./components/auth/Login.jsx'));
const GroupManager = lazy(() => import('./components/groups/GroupManager.jsx'));
const GroupDirectory = lazy(() => import('./components/groups/GroupDirectory.jsx'));
const GroupPage = lazy(() => import('./components/groups/GroupPage.jsx'));
const ArtistDirectory = lazy(() => import('./components/groups/ArtistDirectory.jsx'));
const MemberPage = lazy(() => import('./components/groups/MemberPage.jsx'));
const Binders = lazy(() => import('./components/merch/Binders.jsx'));
const Collectors = lazy(() => import('./components/user/Collectors.jsx'));



function NavigationTabs({ user, canEdit, profileData }) {
  const location = useLocation();

  const isTabActive = (path, isDynamic = false) => {
    if (isDynamic) {
      return location.pathname.startsWith(path);
    }
    return location.pathname === path;
  };

  const getTabStyle = (path, isDynamic = false) => ({
    padding: '1rem 0',
    textDecoration: 'none',
    color: isTabActive(path, isDynamic) ? '#312527' : '#6A585B',
    borderBottom: isTabActive(path, isDynamic) ? '3px solid #8D6E73' : '3px solid transparent',
    fontWeight: '700',
    transition: 'color 0.2s ease',
    whiteSpace: 'nowrap', 
    flexShrink: 0         
  });

  return (
    <nav className="nav-container">
      {user && (
          <Link to={profileData?.username ? `/profile/${profileData.username}` : '/feed'} style={getTabStyle('/profile', true)}>
            Profile
          </Link>
        )}
      <Link to="/collectors" style={getTabStyle('/collectors')}>Community</Link>
      <Link to="/gallery" style={getTabStyle('/gallery')}>Catalog</Link>
      <Link to="/binders" style={getTabStyle('/binders')}>Binders</Link>
      <Link to="/feed" style={getTabStyle('/feed')}>Feed</Link>
      <Link to="/groups" style={getTabStyle('/groups')}>Groups</Link>
      <Link to="/artists" style={getTabStyle('/artists')}>Idols</Link>
      
      {/* SECURITY FIX: Only render Manage tab if the user has edit permissions */}
      {canEdit && <Link to="/manage" style={getTabStyle('/manage')}>Manage</Link>}
      
      <Link className="admin-link" to="/admin" style={{ padding: '1rem 0', color: '#6A585B', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '700', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {user ? 'Logout' : 'Login'}
      </Link>
    </nav>
  );
}

function App() {
  const [user, setUser] = useState(null);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // SECURITY LOGIC: Fetch the profile and check role
  const { profileData } = useUserProfile(user?.uid);
  const canEdit = profileData?.role === 'admin' || profileData?.role === 'collaborator';

  return (
    <AuthProvider>
    <Router>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap');

        *, *::before, *::after {
          box-sizing: border-box !important;
          font-family: 'Quicksand', sans-serif !important;
        }
        html, body, #root {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          min-height: 100vh !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          background-color: #E6DADD !important;
          color: #312527 !important;
          font-family: 'Quicksand', sans-serif !important;
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
        }
        ::placeholder {
          color: #6A585B !important;
          opacity: 0.7 !important;
        }
        select option {
          font-family: 'Quicksand', sans-serif !important;
        }

        .nav-container {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          flex-wrap: nowrap;
          gap: 2.5rem;
          width: 100%;
          border-bottom: 1px solid #D4C4C7;
          margin-bottom: 2rem;
          overflow-x: auto; 
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        .nav-container::-webkit-scrollbar {
          display: none; 
        }

        .nav-container > * {
          flex: 0 0 auto; 
        }

        .admin-link {
          margin-left: auto;
        }

        @media (max-width: 600px) {
          .nav-container {
            gap: 1.5rem; 
            padding-bottom: 2px;
          }
          
          .admin-link {
             margin-left: 0; 
          }
            
          .nav-container::after {
             content: '';
             padding-right: 1rem;
          }
        } 
        
        select {
          appearance: none !important;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23312527' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 0.75rem center !important;
          background-size: 1em !important;
          padding-right: 2rem !important;
        }
        
        button:hover {
          filter: brightness(0.9);
          transition: filter 0.2s;
        }
      `}</style>

      <main style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem 5rem 1rem' }}>

        <header style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <img src="/bunny.png" alt="Bunny" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          <span style={{ fontSize: '1.2rem', fontWeight: '700', color: '#312527', letterSpacing: '0.04em' }}>Juju's Coll Catalog</span>
        </header>

        <NavigationTabs user={user} canEdit={canEdit} profileData={profileData} />

        <div style={{ width: '100%' }}>
          <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem', color: '#6A585B' }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/feed" replace />} />
            <Route path="/profile/:username" element={<Profile user={user} />} />
            <Route path="/collectors" element={<Collectors />} />
            <Route path="/gallery" element={
              <div>
                {canEdit && <AddMerch />}
                <MerchGallery user={user} />
              </div>
            } />
            <Route path="/binders" element={<Binders user={user} />} />
            <Route path="/binders/:binderId" element={<BinderPage user={user} />} />
            <Route path="/feed" element={
              <div>
                {user && <AddPost />}
                <Feed user={user} />
              </div>
            } />
            <Route path="/groups" element={<GroupDirectory />} />
            <Route path="/groups/:groupId" element={<GroupPage />} />
            <Route path="/artists" element={<ArtistDirectory user={user} />} />
            <Route path="/artist/:groupId/:memberName" element={<MemberPage />} />
            
            {/* SECURITY FIX: Route protection for /manage */}
            <Route path="/manage" element={
              canEdit ? <GroupManager /> : (user ? <Navigate to="/groups" replace /> : <Login user={user} />)
            } />
            
            <Route path="/admin" element={<Login user={user} />} />
          </Routes>
          </Suspense>
        </div>
      </main>
      <Footer user={user} />
    </Router>
    </AuthProvider>
  );
}

export default App;