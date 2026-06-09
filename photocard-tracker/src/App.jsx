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

function NavigationTabs({ user, canEdit }) {
  const location = useLocation();
  const { profileData, loading: profileLoading } = useUserProfile(user?.uid);

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
        profileLoading
          ? <span style={{ ...getTabStyle('/profile', true), opacity: 0.4, cursor: 'default' }}>Profile</span>
          : <Link to={profileData?.username ? `/profile/${profileData.username}` : '/feed'} style={getTabStyle('/profile', true)}>
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
      
      <Link className="admin-link" to="/login" style={{ padding: '1rem 0', color: '#6A585B', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '700', flexShrink: 0, whiteSpace: 'nowrap' }}>
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
      <main style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem 5rem 1rem'}}>

        <header style={{ display: 'flex', alignItems: 'center'}}>
          <img src="/J_Header.png" alt="Juju's Coll Catalog" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
        </header>

        <NavigationTabs user={user} canEdit={canEdit} />

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
            
            <Route path="/manage" element={
              canEdit ? <GroupManager /> : (user ? <Navigate to="/groups" replace /> : <Login user={user} />)
            } />
            
           <Route path="/login" element={<Login user={user} />} />
          </Routes>
          </Suspense>
        </div>
      </main>
      <Footer user={user}/>
    </Router>
    </AuthProvider>
  );
}

export default App;