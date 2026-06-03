import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import ItemDetailModal from '../ui/ItemDetailModal';
import ThemeAlert from '../ui/ThemeAlert';

const CustomSelect = ({ value, onChange, options, placeholder, style, dark = false, direction = 'down' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = value ? (options.find(o => o.value === value)?.label ?? value) : placeholder;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', outline: 'none', boxSizing: 'border-box', ...style }}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(!isOpen); } }}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '0.5rem 2.5rem 0.5rem 0.75rem',
          borderRadius: '6px',
          backgroundColor: dark ? '#8D6E73' : '#C2B0B4',
          color: dark ? '#FFFFFF' : '#312527',
          fontSize: '0.85rem',
          cursor: 'pointer',
          backgroundImage: dark
            ? `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23FFFFFF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`
            : `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23312527' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          backgroundSize: '1em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          boxSizing: 'border-box',
          width: '100%',
          fontWeight: dark ? '600' : 'normal',
        }}
      >
        {displayLabel}
      </div>

      {isOpen && (
        <div className="custom-scroll" style={{
          position: 'absolute', 
          top: direction === 'down' ? '100%' : 'auto', 
          bottom: direction === 'up' ? '100%' : 'auto',
          left: 0, right: 0, backgroundColor: '#F9F6F0',
          border: '1px solid #C2B0B4', borderRadius: '6px', 
          marginTop: direction === 'down' ? '4px' : '0',
          marginBottom: direction === 'up' ? '4px' : '0',
          maxHeight: '180px', overflowY: 'auto', overflowX: 'hidden', zIndex: 999,
          boxShadow: '0 4px 16px rgba(49,37,39,0.15)', padding: '0.25rem 0'
        }}>
          {options.map((opt, i) => {
            const isActive = opt.value === value;
            const isHovered = hoveredIndex === i;
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={(e) => { e.stopPropagation(); onChange(opt.value); setIsOpen(false); }}
                style={{
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  backgroundColor: isActive || isHovered ? '#8D6E73' : 'transparent',
                  color: isActive || isHovered ? '#FFFFFF' : '#312527',
                  fontWeight: isActive ? '600' : 'normal',
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function MerchGallery({ user }) {
  const [merch, setMerch] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null); 
  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); 
  
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterEra, setFilterEra] = useState('All');
  const [filterMember, setFilterMember] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState('Member');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [collapsedMainGroups, setCollapsedMainGroups] = useState({});
  const groupsPerPage = 5;

  const [groups, setGroups] = useState([]);

  useEffect(() => {
    setCurrentPage(1);
    setCollapsedGroups({});
    setCollapsedMainGroups({});
  }, [filterGroup, filterCategory, filterEra, filterMember, searchQuery, groupBy, dateStart, dateEnd]);

  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const q = query(collection(db, "merchandise"), orderBy("addedAt", "desc"));
    const unsubMerch = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMerch(data);
      setLoading(false);
    });
    return () => { unsubGroups(); unsubMerch(); };
  }, []);

  const uniqueGroups = ['All', ...Array.from(new Set(groups.map(g => g.name).filter(Boolean))).sort()];
  const currentGroup = filterGroup !== 'All' ? groups.find(g => g.name === filterGroup) : null;

  const handleGroupChange = (newGroup) => {
    setFilterGroup(newGroup);
    setFilterCategory('All');
    setFilterEra('All');
    setFilterMember('All');
  };

  const handleStatusChange = async (itemId, newStatus) => {
    try { await updateDoc(doc(db, "merchandise", itemId), { status: newStatus }); }
    catch (error) { setAlertMsg("Failed to update status."); }
  };

  const handleDelete = (itemId) => setConfirmDelete(itemId);

  const confirmDeleteItem = async () => {
    try { await deleteDoc(doc(db, "merchandise", confirmDelete)); }
    catch (error) { setAlertMsg("Failed to delete."); }
    finally { setConfirmDelete(null); }
  };

  const resetFilters = () => {
    setFilterCategory('All');
    setFilterEra('All');
    setFilterMember('All');
    setSearchQuery('');
    setGroupBy('Member');
    setDateStart('');
    setDateEnd('');
  };

  const toggleCollapse = (blockKey) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [blockKey]: !prev[blockKey]
    }));
  };

  const toggleMainCollapse = (gKey) => {
    setCollapsedMainGroups(prev => ({
      ...prev,
      [gKey]: !prev[gKey]
    }));
  };

  const formatMMYYYY = (val) => val ? `${val.split('-')[1]}/${val.split('-')[0]}` : 'MM/YYYY';

  const groupMerch = filterGroup === 'All' ? merch : merch.filter(i => i.groupName === filterGroup);

  const uniqueEras = ['All', ...(currentGroup?.eras || [])];
  const uniqueMembers = ['All', ...(currentGroup?.members || [])];
  const uniqueCategories = ['All', 'Photocard', 'Album', 'Lightstick', 'Postcard / Poster', 'Plushie / Toy', 'Other'];

  const filteredMerch = groupMerch.filter(item => {
    const matchCategory = filterCategory === 'All' || item.category === filterCategory;
    const matchEra = filterEra === 'All' || item.era === filterEra;
    const matchMember = filterMember === 'All' || item.memberName === filterMember;
    const searchLower = searchQuery.toLowerCase();
    const matchSearch =
      (item.customName || "").toLowerCase().includes(searchLower) ||
      (item.memberName || "").toLowerCase().includes(searchLower);
      
    let matchDate = true;
    if (dateStart || dateEnd) {
      if (!item.releaseDate) {
        matchDate = false; 
      } else {
        const itemDate = item.releaseDate.toDate ? item.releaseDate.toDate() : new Date(item.releaseDate);
        if (dateStart) {
          const start = new Date(dateStart + '-01T00:00:00Z');
          if (itemDate < start) matchDate = false;
        }
        if (dateEnd) {
          const [y, m] = dateEnd.split('-');
          const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
          if (itemDate > end) matchDate = false;
        }
      }
    }
    return matchCategory && matchEra && matchMember && matchSearch && matchDate;
  });

  const groupedData = {};
  filteredMerch.forEach(item => {
    const gKey = item.groupName || 'Unknown Group';
    const subKey = groupBy === 'Member' ? (item.memberName || 'Unknown Member') : (item.era || 'Unknown Era');

    if (!groupedData[gKey]) groupedData[gKey] = {};
    if (!groupedData[gKey][subKey]) groupedData[gKey][subKey] = [];
    groupedData[gKey][subKey].push(item);
  });

  const groupItemCounts = {};
  Object.keys(groupedData).forEach(gKey => {
    groupItemCounts[gKey] = Object.values(groupedData[gKey]).reduce((sum, arr) => sum + arr.length, 0);
  });

  const allGroupBlocks = [];

  const memberOrder = currentGroup?.members || [];
  const eraOrder = currentGroup?.eras || [];

  const subKeyOrder = groupBy === 'Era'
    ? memberOrder
    : eraOrder;    

  const sortedSubKey = (subKeys) => {
    if (subKeyOrder.length === 0) return [...subKeys].sort();
    return [...subKeys].sort((a, b) => {
      const ai = subKeyOrder.indexOf(a);
      const bi = subKeyOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  };

  Object.keys(groupedData).sort().forEach(gKey => {
    sortedSubKey(Object.keys(groupedData[gKey])).forEach(subKey => {
      groupedData[gKey][subKey].sort((a, b) => {
        // Primary: release date latest → oldest
        const dateA = a.releaseDate?.toDate ? a.releaseDate.toDate() : new Date(a.releaseDate || 0);
        const dateB = b.releaseDate?.toDate ? b.releaseDate.toDate() : new Date(b.releaseDate || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        // Secondary: within a Member block → sort by era order; within an Era block → sort by member order
        if (groupBy === 'Member') {
          const ai = eraOrder.indexOf(a.era || '');
          const bi = eraOrder.indexOf(b.era || '');
          if (ai !== -1 || bi !== -1) {
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          }
          return (a.era || '').localeCompare(b.era || '');
        } else {
          const ai = memberOrder.indexOf(a.memberName || '');
          const bi = memberOrder.indexOf(b.memberName || '');
          if (ai !== -1 || bi !== -1) {
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          }
          return (a.memberName || '').localeCompare(b.memberName || '');
        }
      });

      allGroupBlocks.push({ gKey, subKey, items: groupedData[gKey][subKey], key: `${gKey}-${subKey}` });
    });
  });

  const totalPages = Math.ceil(allGroupBlocks.length / groupsPerPage);
  const currentBlocks = allGroupBlocks.slice((currentPage - 1) * groupsPerPage, currentPage * groupsPerPage);

  const renderGrid = (itemsToRender) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1.2rem' }}>
      {itemsToRender.map((item) => {
        const isPhotocard = (item.category || "").toLowerCase() === 'photocard';
        const hasBackprint = isPhotocard && item.backImageUrl;
        const fitStyle = isPhotocard ? 'cover' : 'contain';
        const positionStyle = isPhotocard ? 'top' : 'center';
        const innerBgColor = isPhotocard ? 'transparent' : '#FFFFFF';

        return (
          <div key={item.id} className="merch-card" style={{ borderRadius: '12px', backgroundColor: '#D4C4C7', boxShadow: '0 4px 12px rgba(49,37,39,0.1)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer', width: '100%', aspectRatio: '1 / 1.4', padding: '0.6rem', boxSizing: 'border-box', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              
              {hasBackprint ? (
                <div className="flip-container" style={{ width: '100%', height: '100%' }}>
                  <div className="flipper" style={{ width: '100%', height: '100%' }}>
                    <div className="front" style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                      <img src={item.imageUrl} alt={item.customName} style={{ width: '100%', height: '100%', objectFit: fitStyle, objectPosition: positionStyle, display: 'block' }} />
                    </div>
                    <div className="back" style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                      <img src={item.backImageUrl} alt={`${item.customName} back`} style={{ width: '100%', height: '100%', objectFit: fitStyle, objectPosition: positionStyle, display: 'block' }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: innerBgColor }}>
                  <img src={item.imageUrl} alt={item.customName} style={{ width: '100%', height: '100%', objectFit: fitStyle, objectPosition: positionStyle, display: 'block' }} />
                </div>
              )}
            </div>

            <div style={{ padding: '0.2rem 0.6rem 0.8rem 0.6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flexGrow: 1, gap: '0.1rem' }}>
              <span style={{ fontSize: '0.65rem', color: '#8D6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold' }}>{item.category}</span>
              <h4 style={{ margin: '0.1rem 0 0 0', fontSize: '1.1rem', color: '#312527', fontWeight: '700', cursor: 'pointer', lineHeight: '1.2' }} onClick={() => setSelectedItem(item)}>{item.memberName}</h4>
              <p style={{ margin: '0 0 0.4rem 0', color: '#6A585B', fontSize: '0.85rem' }}>{item.groupName}{item.era ? ` • ${item.era}` : ''}</p>

              {user && (
                <div style={{ width: '100%', marginTop: 'auto', paddingTop: '0.4rem' }}>
                  <CustomSelect
                    value={item.status}
                    onChange={(val) => handleStatusChange(item.id, val)}
                    options={[
                      { value: 'unowned', label: 'Unowned' },
                      { value: 'owned', label: 'Owned' },
                      { value: 'on the way', label: 'On the Way' },
                      { value: 'wishlisted', label: 'Wishlist' },
                    ]}
                    placeholder="Status"
                    direction="up" 
                    style={{ width: '100%', marginBottom: '0.3rem', fontSize: '0.8rem' }}
                  />
                  <button onClick={() => handleDelete(item.id)} style={{ width: '100%', padding: '0.4rem', backgroundColor: 'transparent', color: '#A85A66', border: '1px solid #A85A66', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading) return <p style={{ textAlign: 'center', color: '#6A585B', fontSize: '0.9rem' }}>Loading collection...</p>;

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />

      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(49, 37, 39, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#E6DADD', padding: '1.5rem 2rem', borderRadius: '12px', border: '1px solid #D4C4C7', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '320px', width: '90%' }}>
            <p style={{ color: '#312527', margin: '0 0 1.5rem 0', fontWeight: '600' }}>Are you sure you want to remove this item?</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={confirmDeleteItem} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#8D6E73', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: 'transparent', color: '#8D6E73', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .merch-card { transition: transform 0.2s ease, box-shadow 0.2s ease !important; }
        .merch-card:hover { transform: translateY(-6px); box-shadow: 0 8px 16px rgba(49, 37, 39, 0.15) !important; z-index: 10; }
        .flip-container { perspective: 1000px; width: 100%; height: 100%; cursor: pointer; aspect-ratio: 63 / 100; }
        .flipper { transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1); transform-style: preserve-3d; position: relative; width: 100%; height: 100%; }
        .flip-container:hover .flipper { transform: rotateY(180deg); }
        .front, .back { backface-visibility: hidden; position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; }
        .back { transform: rotateY(180deg); }

        .theme-input, .theme-select { transition: box-shadow 0.2s ease; }
        .theme-input:focus, .theme-select:focus, .theme-date-picker:focus-within { 
          box-shadow: 0 0 0 2px #E6DADD, 0 0 0 4px #8D6E73 !important; outline: none; 
        }

        .custom-scroll::-webkit-scrollbar { width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }
        
        input[type="month"]::-webkit-calendar-picker-indicator {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; padding: 0; opacity: 0; cursor: pointer;
        }

        @media (max-width: 768px) {
          .filter-bar { flex-direction: column; gap: 0.5rem !important; padding: 1rem !important; }
          .filter-bar > * { width: 100% !important; }
          .adv-filters { flex-direction: column; }
          .adv-filters > * { width: 100%; }
          
          /* Gallery Header Adjustments */
          .gallery-header { 
            display: flex !important; 
            flex-direction: row !important;
            justify-content: space-between !important; 
            align-items: center !important; 
          }
          .left-spacer { display: none !important; }
          .gallery-title { text-align: left !important; font-size: 1.1rem !important; margin: 0 !important; }
          
          .merch-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important; }
        }
      `}</style>

      <div className="filter-bar" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', padding: '1.2rem', backgroundColor: '#D4C4C7', borderRadius: '10px', boxShadow: '0 2px 8px rgba(49,37,39,0.08)' }}>
        <CustomSelect
          value={filterGroup}
          onChange={handleGroupChange}
          options={uniqueGroups.map(g => ({ value: g, label: g === 'All' ? 'All Groups' : g }))}
          placeholder="All Groups"
          style={{ flex: '0 0 auto', minWidth: '140px', fontWeight: 'bold' }}
        />

        <input type="text" className="theme-input" placeholder="Search member, custom name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', color: '#312527', fontSize: '0.95rem', outline: 'none' }} />
        
        <button onClick={resetFilters} style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: 'transparent', color: '#8D6E73', border: '2px solid #8D6E73', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600' }}>Reset</button>
        <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ padding: '0.5rem 1.2rem', cursor: 'pointer', backgroundColor: showAdvanced ? '#8D6E73' : '#C2B0B4', color: showAdvanced ? '#FFF' : '#312527', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s' }}>
          {showAdvanced ? 'Hide Filters' : 'Advanced Filters'}
        </button>
      </div>

      {showAdvanced && (
        <div className="adv-filters" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem', padding: '1rem', backgroundColor: '#E6DADD', borderRadius: '10px', border: '1px solid #D4C4C7' }}>
          <CustomSelect
            value={filterCategory}
            onChange={setFilterCategory}
            options={uniqueCategories.map(cat => ({ value: cat, label: cat === 'All' ? 'All Types' : cat }))}
            placeholder="All Types"
            style={{ flex: 1, minWidth: '120px' }}
          />
          <CustomSelect
            value={filterEra}
            onChange={setFilterEra}
            options={uniqueEras.map(era => ({ value: era, label: era === 'All' ? 'All Eras' : era }))}
            placeholder="All Eras"
            style={{ flex: 1, minWidth: '120px' }}
          />
          <CustomSelect
            value={filterMember}
            onChange={setFilterMember}
            options={uniqueMembers.map(member => ({ value: member, label: member === 'All' ? 'All Members' : member }))}
            placeholder="All Members"
            style={{ flex: 1, minWidth: '120px' }}
          />
          
          <div className="theme-date-picker" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#C2B0B4', borderRadius: '6px', padding: '0.5rem 1rem', flex: '0 1 auto', transition: 'box-shadow 0.2s ease' }}>
            <span style={{ fontSize: '0.85rem', color: '#6A585B', fontWeight: '600', whiteSpace: 'nowrap', marginRight: '0.2rem', pointerEvents: 'none' }}>Released:</span>
            
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '65px' }}>
              <span style={{ color: '#312527', fontSize: '0.85rem', fontWeight: '500', pointerEvents: 'none' }}>{formatMMYYYY(dateStart)}</span>
              <input type="month" value={dateStart} onChange={(e) => setDateStart(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            </div>

            <span style={{ color: '#6A585B', fontSize: '0.85rem', fontWeight: 'bold', pointerEvents: 'none' }}>-</span>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '65px' }}>
              <span style={{ color: '#312527', fontSize: '0.85rem', fontWeight: '500', pointerEvents: 'none' }}>{formatMMYYYY(dateEnd)}</span>
              <input type="month" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            </div>
            
            <svg style={{ pointerEvents: 'none', marginLeft: '0.2rem' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
        </div>
      )}

      <div className="gallery-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '1px solid #C2B0B4', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
        <div className="left-spacer" /> 

        <h2 className="gallery-title" style={{ fontSize: '1.3rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527', margin: 0, textAlign: 'center' }}>
          {filterGroup === 'All' ? 'All Groups' : filterGroup} <span style={{ color: '#6A585B', fontWeight: '400', fontSize: '1rem' }}>({filteredMerch.length})</span>
        </h2>

        <div className="group-by-wrapper" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <CustomSelect
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: 'Member', label: 'Group By: Member' },
              { value: 'Era', label: 'Group By: Era' },
            ]}
            placeholder="Group By: Member"
            dark
            style={{ minWidth: 'auto', flex: '0 0 auto' }}
          />
        </div>
      </div>

      {currentBlocks.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#6A585B', fontSize: '0.9rem', marginTop: '2rem' }}>No items match your filters.</p>
      ) : (
        currentBlocks.map((block, index) => {
          const isCollapsed = collapsedGroups[block.key];
          const isMainCollapsed = collapsedMainGroups[block.gKey];
          
          const showGKeyHeader = filterGroup === 'All' && (index === 0 || block.gKey !== currentBlocks[index - 1].gKey);

          return (
            <div key={block.key} style={{ marginBottom: isMainCollapsed ? (showGKeyHeader ? '1.5rem' : '0') : '3rem' }}>
              
              {showGKeyHeader && (
                <div 
                  onClick={() => toggleMainCollapse(block.gKey)}
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', borderBottom: '2px solid #C2B0B4', paddingBottom: '0.5rem', marginBottom: isMainCollapsed ? '0' : '1.5rem', transition: 'opacity 0.2s', userSelect: 'none' }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = 0.7}
                  onMouseOut={(e) => e.currentTarget.style.opacity = 1}
                >
                  <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527' }}>
                    {block.gKey} <span style={{ color: '#6A585B', fontWeight: '400', fontSize: '1.2rem', textTransform: 'none' }}>— {groupItemCounts[block.gKey]} items</span>
                  </h2>
                  <div style={{ marginLeft: '1rem', backgroundColor: '#C2B0B4', color: '#312527', borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {isMainCollapsed ? 'SHOW ▼' : 'HIDE ▲'}
                  </div>
                </div>
              )}

              {!isMainCollapsed && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div 
                    onClick={() => toggleCollapse(block.key)}
                    style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', paddingLeft: '0.5rem', borderLeft: '4px solid #8D6E73', transition: 'opacity 0.2s', userSelect: 'none' }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = 0.7}
                    onMouseOut={(e) => e.currentTarget.style.opacity = 1}
                  >
                    <h3 style={{ margin: 0, textAlign: 'left', fontSize: '1rem', color: '#8D6E73', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {block.subKey} <span style={{ color: '#6A585B', fontWeight: '400', fontSize: '0.85rem', textTransform: 'none' }}>— {block.items.length} items</span>
                    </h3>
                    <div style={{ marginLeft: '0.75rem', backgroundColor: '#C2B0B4', color: '#312527', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      {isCollapsed ? 'SHOW ▼' : 'HIDE ▲'}
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '1rem', display: isCollapsed ? 'none' : 'block' }}>
                    {renderGrid(block.items)}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #C2B0B4' }}>
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ padding: '0.5rem 1rem', backgroundColor: currentPage === 1 ? '#C2B0B4' : '#8D6E73', color: currentPage === 1 ? '#6A585B' : '#FFF', border: 'none', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
          >
            Previous
          </button>
          <span style={{ color: '#312527', fontWeight: '600', fontSize: '0.95rem' }}>Page {currentPage} of {totalPages}</span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{ padding: '0.5rem 1rem', backgroundColor: currentPage === totalPages ? '#C2B0B4' : '#8D6E73', color: currentPage === totalPages ? '#6A585B' : '#FFF', border: 'none', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
          >
            Next
          </button>
        </div>
      )}

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} user={user} />
    </div>
  );
}