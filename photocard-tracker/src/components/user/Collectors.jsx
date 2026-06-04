import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import UserSearch from '../ui/UserSearch'; // Adjust this path if needed

export default function Collectors() {
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const snap = await getDocs(collection(db, 'profile'));
        setCollectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching profiles:", error);
      }
      setLoading(false);
    };
    fetchProfiles();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6A585B' }}>Loading community...</div>;

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      <h1 style={{ color: '#312527', margin: '0 0 1.5rem 0', fontSize: '1.8rem', fontWeight: '700' }}>Community</h1>

      {/* Reuse your search bar here so guests can search too! */}
      <div style={{ marginBottom: '3rem' }}>
        <UserSearch />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem' }}>
        {collectors.map(c => (
          <Link key={c.id} to={`/profile/${c.id}`} style={{ textDecoration: 'none' }}>
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
                src={c.avatarUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23C2B0B4'/%3E%3C/svg%3E"}
                alt={c.name}
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem', border: '3px solid #E6DADD' }}
              />
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#312527', fontSize: '1.1rem', fontWeight: '700' }}>{c.name || 'Collector'}</h3>
              <p style={{ margin: 0, color: '#6A585B', fontSize: '0.85rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {c.bio || 'Collecting K-Pop!'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}