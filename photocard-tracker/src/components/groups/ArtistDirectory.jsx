import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function ArtistDirectory({ user }) {
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set()); 
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

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) newSet.delete(groupId);
      else newSet.add(groupId);
      return newSet;
    });
  };

  const filteredGroups = groups.map(group => {
    const searchLower = searchQuery.toLowerCase();
    const groupMatches = group.name.toLowerCase().includes(searchLower);
    
    const rawMembers = group.members || []; 
    const richMembersData = group.membersData || [];
    
    const unifiedMembers = rawMembers.map(memberName => {
      const richData = richMembersData.find(m => m.name === memberName) || {};
      return {
        id: memberName, 
        name: memberName,
        ...richData 
      };
    });

    const filteredMembers = unifiedMembers.filter(m => 
      m.name.toLowerCase().includes(searchLower) || (m.hangulName && m.hangulName.includes(searchLower))
    );
    
    return { ...group, filteredMembers, groupMatches };
  }).filter(group => group.groupMatches || group.filteredMembers.length > 0);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#6A585B' }}>Loading artists...</div>;
  }

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      
      <style>{`
        /* Global Highlight Effect */
        .theme-input { transition: box-shadow 0.2s ease; outline: none; }
        .theme-input:focus { box-shadow: 0 0 0 2px #D4C4C7, 0 0 0 4px #8D6E73 !important; }
      `}</style>

      <div style={{ marginBottom: '2rem', padding: '1.2rem', backgroundColor: '#D4C4C7', borderRadius: '10px' }}>
        <input 
          className="theme-input"
          type="text" 
          placeholder="Search groups or members..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', color: '#312527', outline: 'none' }} 
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {filteredGroups.map(group => {
          const isCollapsed = collapsedGroups.has(group.id);

          return (
            <div key={group.id} style={{ backgroundColor: '#D4C4C7', borderRadius: '12px', overflow: 'hidden' }}>
              
              <div 
                onClick={() => toggleGroup(group.id)} 
                style={{ padding: '1rem 1.5rem', backgroundColor: '#C2B0B4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#312527' }}>
                  {group.name} <span style={{ fontSize: '0.9rem', color: '#6A585B', fontWeight: '400' }}>({group.filteredMembers.length})</span>
                </h2>
                
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="22" 
                  height="22" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#6A585B" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  style={{ 
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', 
                    transition: 'transform 0.2s ease' 
                  }}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>

              {!isCollapsed && (
                <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                  {group.filteredMembers.map(member => (
                    
                    <div 
                      key={member.id} 
                      onClick={() => navigate(`/artist/${group.id}/${member.name}`)}
                      style={{ cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div style={{ width: '100px', height: '100px', margin: '0 auto 0.5rem', borderRadius: '50%', backgroundColor: '#C2B0B4', overflow: 'hidden', border: '3px solid #E6DADD', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                        <img src={member.profileImageUrl || '/bunny.png'} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      </div>
                      <h4 style={{ margin: 0, color: '#312527', fontSize: '0.9rem' }}>{member.name}</h4>
                      <p style={{ margin: 0, color: '#8D6E73', fontSize: '0.75rem' }}>{member.animal || ''}</p>
                    </div>
                  ))}
                  
                  {group.filteredMembers.length === 0 && <p style={{ color: '#6A585B', fontSize: '0.9rem', gridColumn: '1 / -1' }}>No members match your search.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}