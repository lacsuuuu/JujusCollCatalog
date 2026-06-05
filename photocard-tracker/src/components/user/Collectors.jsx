import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, getDocs, query, limit, startAfter } from 'firebase/firestore';
import UserSearch from '../ui/UserSearch';
import { optimizeUrl } from '../../utils/imageKitUtils';

export default function Collectors() {
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination States
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const fetchInitialProfiles = async () => {
      try {
        // Fetch only the first 20 profiles
        const q = query(collection(db, 'profile'), limit(20));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          setCollectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setLastDoc(snap.docs[snap.docs.length - 1]);
          setHasMore(snap.docs.length === 20); // If we hit exactly 20, there are likely more
        } else {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Error fetching profiles:", error);
      }
      setLoading(false);
    };
    fetchInitialProfiles();
  }, []);

  // The Load More function 
  const loadMore = async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);
    
    try {
      // Pick up exactly where the last query left off
      const q = query(collection(db, 'profile'), startAfter(lastDoc), limit(20));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        // Glue the new users to the bottom of the list in browser memory
        setCollectors(prev => [...prev, ...snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))]);
        setLastDoc(snap.docs[snap.docs.length - 1]);
        setHasMore(snap.docs.length === 20);
      } else {
        setHasMore(false); // We've reached the end of the database
      }
    } catch (error) {
      console.error("Error loading more profiles:", error);
    }
    setLoadingMore(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6A585B' }}>Loading community...</div>;

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      <h1 style={{ color: '#312527', margin: '0 0 1.5rem 0', fontSize: '1.8rem', fontWeight: '700' }}>Community</h1>

      {/* Reuse your search bar here so guests can search too! */}
      <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'flex-end' }}>
        <UserSearch />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem' }}>
        {collectors.map(c => (
          <Link key={c.id} to={`/profile/${c.username}`} style={{ textDecoration: 'none' }}>
            <div style={{
              backgroundColor: '#D4C4C7',
              padding: '1.5rem',
              borderRadius: '12px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(49,37,39,0.08)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(49,37,39,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(49,37,39,0.08)';
            }}>
              <img
                src={optimizeUrl(c.avatarUrl || '/bunny.png')}
                alt={c.name}
                loading="lazy"
                decoding="async"
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem', border: '3px solid #E6DADD' }}
              />
              <h3 style={{ margin: '0 0 0.25rem 0', color: '#312527', fontSize: '1rem', fontWeight: '700' }}>{c.name || c.username || 'Collector'}</h3>
              {c.username && (
                <p style={{ margin: 0, color: '#8D6E73', fontSize: '0.82rem', fontWeight: '500' }}>
                  @{c.username}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
      
      {/* ADDED: Load More Button */}
      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
          <button 
            onClick={loadMore} 
            disabled={loadingMore}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: loadingMore ? '#D4C4C7' : '#8D6E73',
              color: '#FFF',
              border: 'none',
              borderRadius: '30px',
              fontWeight: 'bold',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}