import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AuthProvider } from './context/AuthContext';
import BinderPage from './components/merch/BinderPage';
import { useUserProfile } from './hooks/useUserProfile';
import Footer from './components/ui/Footer';

// Icon imports (Removed Settings, Layers since we combined them into Idols)
import { User, Users, Grid, BookOpen, Mic2, LogOut, LogIn, Edit3 } from 'lucide-react';

const Profile = lazy(() => import('./components/user/Profile.jsx'));
const AddMerch = lazy(() => import('./components/merch/AddMerch.jsx'));
const MerchGallery = lazy(() => import('./components/merch/MerchGallery.jsx'));
const AddPost = lazy(() => import('./components/feed/AddPost.jsx'));
const Feed = lazy(() => import('./components/feed/Feed.jsx'));
const Login = lazy(() => import('./components/auth/Login.jsx'));
const Binders = lazy(() => import('./components/merch/Binders.jsx'));
const Collectors = lazy(() => import('./components/user/Collectors.jsx'));

// Group imports
const GroupPage = lazy(() => import('./components/groups/GroupPage.jsx'));
const MemberPage = lazy(() => import('./components/groups/MemberPage.jsx'));
const Idols = lazy(() => import('./components/groups/Idols.jsx')); // <-- New combined component

// CSS embedded to maintain hover states
const sideNavStyles = `
  .sidenav {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 65px;
    background-color: #fcfbfb;
    border-right: 2px solid rgba(141, 110, 115, 0.2);
    display: flex;
    flex-direction: column;
    padding-top: 1.5rem;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    overflow: hidden;
    white-space: nowrap;
    box-shadow: 2px 0 8px rgba(0,0,0,0.05);
  }

  .sidenav:hover {
    width: 220px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    padding: 1rem;
    color: #6A585B;
    text-decoration: none;
    font-weight: 700;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .nav-item:hover {
    color: #312527;
    background-color: rgba(141, 110, 115, 0.1);
  }

  .nav-item.active {
    color: #312527;
    border-right: 4px solid #8D6E73;
    background-color: rgba(141, 110, 115, 0.05);
  }

  .nav-icon {
    min-width: 24px;
    margin-left: 0.25rem;
    margin-right: 1.5rem;
  }
  
  .nav-logo-img {
    width: 24px;
    height: 24px;
    object-fit: contain;
    margin-left: 0.25rem;
    margin-right: 1.5rem;
    flex-shrink: 0;
  }

  .nav-text {
    opacity: 0;
    transition: opacity 0.2s ease;
    transition-delay: 0s;
  }

  .sidenav:hover .nav-text {
    opacity: 1;
    transition-delay: 0.1s;
  }

  .nav-divider {
    height: 1px;
    background-color: rgba(141, 110, 115, 0.2);
    margin: 0.5rem 1rem 1rem 1rem;
  }

  .nav-bottom {
    margin-top: auto;
    margin-bottom: 2rem;
  }

  .add-post-collapsible {
    background: #fcfbfb;
    border: 1px solid rgba(141, 110, 115, 0.2);
    border-radius: 8px;
    margin-bottom: 2rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    transition: all 0.3s ease;
  }

  .add-post-collapsible summary {
    padding: 1rem;
    font-weight: 700;
    color: #6A585B;
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: color 0.2s ease;
  }

  .add-post-collapsible summary::-webkit-details-marker {
    display: none;
  }

  .add-post-collapsible summary:hover {
    color: #312527;
    background-color: rgba(141, 110, 115, 0.05);
    border-radius: 8px;
  }

  .add-post-collapsible[open] summary {
    border-bottom: 1px solid rgba(141, 110, 115, 0.1);
    border-radius: 8px 8px 0 0;
  }
  
  .add-post-content {
    padding: 1rem;
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

function NavigationTabs({ user }) {
  const location = useLocation();
  const { profileData, loading: profileLoading } = useUserProfile(user?.uid);

  const isTabActive = (path, isDynamic = false) => {
    if (isDynamic) {
      return location.pathname.startsWith(path);
    }
    return location.pathname === path;
  };

  const getActiveClass = (path, isDynamic = false) => {
    return isTabActive(path, isDynamic) ? 'nav-item active' : 'nav-item';
  };

  return (
    <>
      <style>{sideNavStyles}</style>
      <nav className="sidenav">
        
        <Link to="/feed" className={getActiveClass('/feed')}>
          <img src="/J_Logo.png" alt="Home" className="nav-logo-img" />
          <span className="nav-text">Home</span>
        </Link>
        
        <div className="nav-divider"></div>

        {user && (
          profileLoading ? (
            <div className="nav-item" style={{ opacity: 0.4, cursor: 'default' }}>
              <User className="nav-icon" size={24} />
              <span className="nav-text">Profile</span>
            </div>
          ) : (
            <Link to={profileData?.username ? `/profile/${profileData.username}` : '/feed'} className={getActiveClass('/profile', true)}>
              <User className="nav-icon" size={24} />
              <span className="nav-text">Profile</span>
            </Link>
          )
        )}
        
        <Link to="/collectors" className={getActiveClass('/collectors')}>
          <Users className="nav-icon" size={24} />
          <span className="nav-text">Community</span>
        </Link>
        
        <Link to="/gallery" className={getActiveClass('/gallery')}>
          <Grid className="nav-icon" size={24} />
          <span className="nav-text">Catalog</span>
        </Link>
        
        <Link to="/binders" className={getActiveClass('/binders')}>
          <BookOpen className="nav-icon" size={24} />
          <span className="nav-text">Binders</span>
        </Link>
        
        <Link to="/idols" className={getActiveClass('/idols')}>
          <Mic2 className="nav-icon" size={24} />
          <span className="nav-text">Idols</span>
        </Link>

        <div className="nav-bottom">
          {user ? (
            <div 
              className="nav-item" 
              onClick={() => signOut(auth).catch(error => console.error("Error logging out:", error))}
            >
              <LogOut className="nav-icon" size={24} />
              <span className="nav-text">Logout</span>
            </div>
          ) : (
            <Link to="/login" className="nav-item">
              <LogIn className="nav-icon" size={24} />
              <span className="nav-text">Login</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const { profileData } = useUserProfile(user?.uid);
  const canEdit = profileData?.role === 'admin' || profileData?.role === 'collaborator';

  return (
    <AuthProvider>
      <Router>
        <NavigationTabs user={user} />

        <div style={{ paddingLeft: '65px', width: '100%', minHeight: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          
          <main style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem 5rem 1rem', flex: 1 }}>

            <header style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
              <img src="/J_Header.png" alt="Juju's Coll Catalog" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
            </header>

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
                      {user && (
                        <details className="add-post-collapsible">
                          <summary>
                            <Edit3 size={18} />
                            Create Post
                          </summary>
                          <div className="add-post-content">
                            <AddPost />
                          </div>
                        </details>
                      )}
                      <Feed user={user} />
                    </div>
                  } />
                  
                  {/* Replaced individual routes with the consolidated Idols route */}
                  <Route path="/idols" element={<Idols user={user} canEdit={canEdit} />} />
                  
                  {/* Kept dynamic routes for specific groups and members so links still work */}
                  <Route path="/groups/:groupId" element={<GroupPage />} />
                  <Route path="/artist/:groupId/:memberName" element={<MemberPage />} />
                  
                  <Route path="/login" element={<Login user={user} />} />
                </Routes>
              </Suspense>
            </div>
          </main>
          
          <Footer user={user}/>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;