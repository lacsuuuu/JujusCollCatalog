import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function UserSearch() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Fetch all profiles once when the component mounts
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const snap = await getDocs(collection(db, 'profile'));
        const profileList = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProfiles(profileList);
      } catch (error) {
        console.error("Error fetching profiles:", error);
      }
    };
    fetchProfiles();
  }, []);

  // Filter profiles whenever the user types
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredResults([]);
      setIsOpen(false);
      return;
    }

    const lowerSearch = searchTerm.toLowerCase();
    const results = profiles.filter(profile => 
      profile.name?.toLowerCase().includes(lowerSearch)
    );
    
    setFilteredResults(results);
    setIsOpen(true);
  }, [searchTerm, profiles]);

  // Close dropdown if clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (userId) => {
    setSearchTerm('');
    setIsOpen(false);
    navigate(`/profile/${userId}`);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '400px', marginBottom: '2rem', zIndex: 100 }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="theme-input" // <--- ADD THIS LINE
          placeholder="Search for collectors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.8rem 1rem 0.8rem 2.5rem',
            borderRadius: '30px',
            border: 'none',
            backgroundColor: '#C2B0B4', // (Or whichever darker color you chose)
            color: '#312527',
            fontSize: '0.95rem',
            outline: 'none',
            boxShadow: '0 2px 8px rgba(49,37,39,0.1)',
            transition: 'box-shadow 0.2s',
            boxSizing: 'border-box'
          }}
          onFocus={() => searchTerm.trim() !== '' && setIsOpen(true)}
        />
        {/* Search Icon */}
        <svg 
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} 
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>

      {/* Dropdown Results */}
      {isOpen && filteredResults.length > 0 && (
        <div className="custom-scroll" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
          backgroundColor: '#F9F6F0', borderRadius: '12px', border: '1px solid #D4C4C7',
          boxShadow: '0 8px 24px rgba(49,37,39,0.15)', maxHeight: '250px', overflowY: 'auto'
        }}>
          {filteredResults.map(profile => (
            <div 
              key={profile.id}
              onClick={() => handleSelectUser(profile.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem',
                cursor: 'pointer', borderBottom: '1px solid #E6DADD', transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E6DADD'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <img 
                src={profile.avatarUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23C2B0B4'/%3E%3C/svg%3E"} 
                alt={profile.name} 
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#312527', fontWeight: 'bold', fontSize: '0.95rem' }}>{profile.name}</span>
                <span style={{ color: '#8D6E73', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                  {profile.bio || "Collector"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {isOpen && filteredResults.length === 0 && searchTerm.trim() !== '' && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: '#F9F6F0', borderRadius: '12px', border: '1px solid #D4C4C7', padding: '1rem', textAlign: 'center', color: '#6A585B', boxShadow: '0 8px 24px rgba(49,37,39,0.15)' }}>
          No collectors found.
        </div>
      )}
    </div>
  );
}