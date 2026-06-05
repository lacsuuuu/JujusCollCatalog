import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { optimizeUrl } from '../../utils/imageKitUtils';

export default function UserSearch() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const wrapperRef = useRef(null);

  // Search Firestore dynamically as the user types, with a debounce
  useEffect(() => {
    const fetchSearchResults = async () => {
      const trimmedTerm = searchTerm.trim();
      
      if (trimmedTerm === '') {
        setFilteredResults([]);
        setIsOpen(false);
        return;
      }

      setIsSearching(true);
      try {
        const [usernameSnap, displayNameSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'profile'),
            where('username', '>=', trimmedTerm),
            where('username', '<=', trimmedTerm + '\uf8ff'),
            limit(10)
          )),
          getDocs(query(
            collection(db, 'profile'),
            where('displayName', '>=', trimmedTerm),
            where('displayName', '<=', trimmedTerm + '\uf8ff'),
            limit(10)
          ))
        ]);

        const combined = new Map();
        usernameSnap.docs.forEach(doc => {
          if (doc.id !== 'system') combined.set(doc.id, { id: doc.id, ...doc.data() });
        });
        displayNameSnap.docs.forEach(doc => {
          if (doc.id !== 'system') combined.set(doc.id, { id: doc.id, ...doc.data() });
        });

        const sortedResults = Array.from(combined.values())
          .sort((a, b) => {
            const aName = (a.displayName || a.username || '').toLowerCase();
            const bName = (b.displayName || b.username || '').toLowerCase();
            return aName.localeCompare(bName);
          })
          .slice(0, 15);

        setFilteredResults(sortedResults);
        setIsOpen(true);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSearchResults();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectUser = (username) => {
    setIsOpen(false);
    setSearchTerm('');
    navigate(`/profile/${username}`);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <svg 
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          placeholder="Search collectors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={(e) => {
            e.target.style.boxShadow = '0 0 0 2px #E6DADD, 0 0 0 4px #8D6E73';
            if (searchTerm.trim() !== '') setIsOpen(true);
          }}
          onBlur={(e) => {
            e.target.style.boxShadow = 'none';
          }}
          style={{
            width: '100%',
            padding: '0.65rem 2rem 0.65rem 2.5rem',
            borderRadius: '6px',
            border: '1px solid #D4C4C7',
            backgroundColor: '#C2B0B4',
            color: '#312527',
            fontSize: '0.9rem',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'box-shadow 0.2s ease',
          }}
        />
        {searchTerm && (
          <button
            onClick={() => { setSearchTerm(''); setIsOpen(false); setFilteredResults([]); }}
            style={{
              position: 'absolute', right: '10px', background: 'transparent', border: 'none',
              color: '#8D6E73', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {isOpen && !isSearching && filteredResults.length > 0 && (
        <div 
          className="custom-scroll"
          style={{ 
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', 
            backgroundColor: '#F9F6F0', border: '1px solid #C2B0B4', borderRadius: '12px', 
            maxHeight: '300px', overflowY: 'auto', zIndex: 1000,
            boxShadow: '0 10px 25px rgba(49,37,39,0.15)',
            padding: '0.5rem 0'
          }}
        >
          {filteredResults.map(profile => (
            <div 
              key={profile.id} 
              onClick={() => handleSelectUser(profile.username)}
              style={{ 
                padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', 
                cursor: 'pointer', transition: 'background-color 0.2s', borderBottom: '1px solid rgba(194,176,180,0.3)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E6DADD'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <img 
                src={optimizeUrl(profile.avatarUrl || '/bunny.png')} 
                alt={profile.name} 
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {profile.displayName && (
                  <span style={{ color: '#312527', fontWeight: 'bold', fontSize: '0.95rem' }}>{profile.displayName}</span>
                )}
                <span style={{ color: '#8D6E73', fontSize: '0.75rem' }}>@{profile.username}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {isOpen && !isSearching && filteredResults.length === 0 && searchTerm.trim() !== '' && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: '#F9F6F0', border: '1px solid #C2B0B4', borderRadius: '12px', padding: '1rem', textAlign: 'center', zIndex: 1000, boxShadow: '0 4px 12px rgba(49,37,39,0.1)' }}>
          <p style={{ margin: 0, color: '#6A585B', fontSize: '0.9rem' }}>No collectors found for "{searchTerm}"</p>
        </div>
      )}

      {isOpen && isSearching && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: '#F9F6F0', border: '1px solid #C2B0B4', borderRadius: '12px', padding: '1rem', textAlign: 'center', zIndex: 1000, boxShadow: '0 4px 12px rgba(49,37,39,0.1)' }}>
          <p style={{ margin: 0, color: '#8D6E73', fontSize: '0.9rem', fontWeight: 'bold' }}>Searching...</p>
        </div>
      )}
    </div>
  );
}