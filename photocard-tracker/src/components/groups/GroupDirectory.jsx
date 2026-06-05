import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { optimizeUrl } from '../../utils/imageKitUtils';

export default function GroupDirectory() {
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'groups'));
        setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching groups:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  const filteredGroups = groups.filter(g =>
    g.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#6A585B' }}>Loading groups...</div>;
  }

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      <style>{`
        .theme-input { transition: box-shadow 0.2s ease; outline: none; }
        .theme-input:focus { box-shadow: 0 0 0 2px #D4C4C7, 0 0 0 4px #8D6E73 !important; }
        .group-card { transition: transform 0.2s ease; }
        .group-card:hover { transform: translateY(-4px); }
      `}</style>

      <div style={{ marginBottom: '2rem', padding: '1.2rem', backgroundColor: '#D4C4C7', borderRadius: '10px' }}>
        <input
          className="theme-input"
          type="text"
          placeholder="Search groups..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', color: '#312527', outline: 'none' }}
        />
      </div>

      {filteredGroups.length === 0 ? (
        <p style={{ color: '#6A585B', textAlign: 'center', padding: '2rem' }}>No groups found.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1.5rem' }}>
          {filteredGroups.map(group => (
            <div
              key={group.id}
              className="group-card"
              onClick={() => navigate(`/groups/${group.id}`)}
              style={{ cursor: 'pointer', textAlign: 'center' }}
            >
              <div style={{ width: '110px', height: '110px', margin: '0 auto 0.75rem', borderRadius: '50%', backgroundColor: '#C2B0B4', overflow: 'hidden', border: '3px solid #E6DADD', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                <img
                  src={optimizeUrl(group.groupImageUrl || '/bunny.png')}
                  alt={group.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
              </div>
              <h4 style={{ margin: '0 0 0.2rem 0', color: '#312527', fontSize: '0.95rem', fontWeight: '700' }}>{group.name}</h4>
              <p style={{ margin: 0, color: '#8D6E73', fontSize: '0.75rem', fontWeight: '600' }}>{group.fandomName || ''}</p>
              <p style={{ margin: '0.1rem 0 0', color: '#6A585B', fontSize: '0.72rem' }}>{(group.members || []).length} members</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}