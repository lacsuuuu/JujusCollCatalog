import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import Cropper from 'react-easy-crop';
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

export default function Profile({ user }) {
  const [merch, setMerch] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  
  const defaultAvatar = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23C2B0B4'/%3E%3Ctext x='150' y='160' text-anchor='middle' font-size='80' fill='%23312527' font-family='sans-serif'%3EKP%3C/text%3E%3C/svg%3E`;
  const defaultBanner = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1000' height='250'%3E%3Crect width='1000' height='250' fill='%23D4C4C7'/%3E%3Ctext x='500' y='140' text-anchor='middle' font-size='40' fill='%236A585B' font-family='sans-serif'%3EYour Banner%3C/text%3E%3C/svg%3E`;

  const [profileData, setProfileData] = useState({
    name: "My K-Pop Collection",
    bio: "Collecting NewJeans, Stray Kids, and everything in between. 🌸",
    avatarUrl: defaultAvatar, 
    bannerUrl: defaultBanner 
  });
  
  const [editForm, setEditForm] = useState(profileData);

  const [groups, setGroups] = useState([]);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterEra, setFilterEra] = useState('All');
  const [filterMember, setFilterMember] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [groupBy, setGroupBy] = useState('Member');
  const [currentPage, setCurrentPage] = useState(1);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [collapsedMainGroups, setCollapsedMainGroups] = useState({});
  const groupsPerPage = 5;

  const [imageToCrop, setImageToCrop] = useState(null);
  const [croppingField, setCroppingField] = useState(null); 
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const profileSnap = await getDoc(doc(db, "profile", "main"));
      if (profileSnap.exists()) {
        setProfileData(profileSnap.data());
        setEditForm(profileSnap.data());
      }
    };
    fetchProfile();

    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const q = query(collection(db, "merchandise"), orderBy("addedAt", "desc"));
    const unsubMerch = onSnapshot(q, (snapshot) => {
      setMerch(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => { unsubGroups(); unsubMerch(); };
  }, []);

  const handleSaveProfile = async () => {
    try {
      await setDoc(doc(db, "profile", "main"), editForm);
      setProfileData(editForm);
      setIsEditing(false);
      setAlertMsg("Profile updated successfully!"); 
    } catch (error) {
      setAlertMsg("Database Error.");
    }
  };

  const handleImageClick = (field) => {
    if (!isEditing) return;
    setCroppingField(field === 'avatar'? 'avatarUrl' : 'bannerUrl'); 
    fileInputRef.current.click();
  };

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const imageUrl = URL.createObjectURL(file);
        setImageToCrop(imageUrl);
        e.target.value = '';
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCrop = async () => {
    if (!croppedAreaPixels) return;

    try {
      const croppedImageBase64 = await getCroppedImg(imageToCrop, croppedAreaPixels, croppingField);
      const res = await fetch(croppedImageBase64);
      const uploadBlob = await res.blob();

      const formData = new FormData();
      formData.append('file', uploadBlob);
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      formData.append('upload_preset', uploadPreset);
      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      const cloudData = await cloudRes.json();

      setEditForm(prev => ({
        ...prev,
        [croppingField]: cloudData.secure_url,
      }));

      setImageToCrop(null);
      setCroppingField(null);
    } catch (e) {
      console.error("FAILED AT:", e);
      alert("Failed to process image.");
    }
  };

  const handleImageError = (e, fallback) => {
    e.target.src = fallback;
  };

  // 1. Get unique groups and rank them by how much merch they have (Highest to Lowest)
  const uniqueGroupNames = groups.map(g => g.name).filter(Boolean).sort();
  
  const sortedGroupsByCount = [...uniqueGroupNames].sort((a, b) => {
    const countA = merch.filter(item => item.groupName === a).length;
    const countB = merch.filter(item => item.groupName === b).length;
    return countB - countA;
  });

  // 2. Auto-select the #1 group on load (waiting for merch to finish loading first)
  useEffect(() => {
    if (!loading && filterGroup === 'All' && sortedGroupsByCount.length > 0) {
      setFilterGroup(sortedGroupsByCount[0]);
    }
  }, [loading, filterGroup, sortedGroupsByCount[0]]);

  const currentGroup = groups.find(g => g.name === filterGroup);

  // 3. Pull predefined DB lists ONLY for the selected group
  const dbEras = currentGroup?.eras || [];
  const dbMembers = currentGroup?.members || [];

  // 4. Isolate the currently active merch
  const activeMerch = merch.filter(i => i.groupName === filterGroup);

  // 5. Combine DB data with merch data, deduplicate with Set, and sort
  const uniqueEras = [
    'All', 
    ...[...new Set([
      ...dbEras, 
      ...activeMerch.map(i => i.era)
    ].filter(Boolean))].sort()
  ];
  
  const uniqueMembers = [
    'All', 
    ...[...new Set([
      ...dbMembers, 
      ...activeMerch.map(i => i.memberName)
    ].filter(Boolean))].sort()
  ];

  const uniqueCategories = ['All', 'Photocard', 'Album', 'Lightstick', 'Postcard / Poster', 'Plushie / Toy', 'Other'];

  const handleGroupChange = (val) => {
    setFilterGroup(val);
    setFilterEra('All');
    setFilterMember('All');
    setFilterCategory('All');
  };

  const resetFilters = () => {
    setFilterCategory('All');
    if (uniqueGroupNames.length > 0) setFilterGroup(uniqueGroupNames[0]);
    setFilterEra('All');
    setFilterMember('All');
    setSearchQuery('');
    setDateStart('');
    setDateEnd('');
  };

  useEffect(() => {
    setCurrentPage(1);
    setCollapsedGroups({});
    setCollapsedMainGroups({});
  }, [filterGroup, filterCategory, filterEra, filterMember, searchQuery, groupBy, dateStart, dateEnd]);

  const toggleCollapse = (blockKey) => setCollapsedGroups(prev => ({ ...prev, [blockKey]: !prev[blockKey] }));
  const toggleMainCollapse = (gKey) => setCollapsedMainGroups(prev => ({ ...prev, [gKey]: !prev[gKey] }));

  const formatMMYYYY = (val) => val ? `${val.split('-')[1]}/${val.split('-')[0]}` : 'MM/YYYY';

  const filteredMerch = merch.filter(item => {
    const matchCategory = filterCategory === 'All' || item.category === filterCategory;
    const matchGroup = filterGroup === 'All' || item.groupName === filterGroup;
    const matchEra = filterEra === 'All' || item.era === filterEra;
    const matchMember = filterMember === 'All' || item.memberName === filterMember;
    const searchLower = searchQuery.toLowerCase();
    const matchSearch =
      (item.customName || "").toLowerCase().includes(searchLower) ||
      (item.groupName || "").toLowerCase().includes(searchLower) ||
      (item.memberName || "").toLowerCase().includes(searchLower);
      
    let matchDate = true;
    if (dateStart || dateEnd) {
      if (!item.releaseDate) {
        matchDate = false;
      } else {
        const itemDate = item.releaseDate?.toDate ? item.releaseDate.toDate() : new Date(item.releaseDate);
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
    return matchCategory && matchGroup && matchEra && matchMember && matchSearch && matchDate;
  });

  const ownedCollection = filteredMerch.filter(item => item.status === 'owned' || item.status === 'on the way');
  const wishlistCollection = filteredMerch.filter(item => item.status === 'wishlisted');

  const buildGroupBlocks = (items) => {
    const groupedData = {};
    items.forEach(item => {
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

    const blocks = [];

    const memberOrder = currentGroup?.members || [];
    const eraOrder = currentGroup?.eras || [];
    const subKeyOrder = groupBy === 'Era' ? memberOrder : eraOrder;

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
          const aFav = a.isFavorite ? 1 : 0;
          const bFav = b.isFavorite ? 1 : 0;
          if (aFav !== bFav) return bFav - aFav;

          const dateA = a.releaseDate?.toDate ? a.releaseDate.toDate() : new Date(a.releaseDate || 0);
          const dateB = b.releaseDate?.toDate ? b.releaseDate.toDate() : new Date(b.releaseDate || 0);
          if (dateB - dateA !== 0) return dateB - dateA;

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
        blocks.push({ gKey, subKey, items: groupedData[gKey][subKey], key: `${gKey}-${subKey}` });
      });
    });

    return { blocks, groupItemCounts };
  };

  const renderGroupedSection = (items, emptyMsg, pageKey) => {
    const { blocks, groupItemCounts } = buildGroupBlocks(items);
    const totalPages = Math.ceil(blocks.length / groupsPerPage);
    const page = currentPage;
    const currentBlocks = blocks.slice((page - 1) * groupsPerPage, page * groupsPerPage);

    if (blocks.length === 0) return <p style={{ color: '#6A585B', fontSize: '0.9rem' }}>{emptyMsg}</p>;

    return (
      <>
        {currentBlocks.map((block, index) => {
          const isCollapsed = collapsedGroups[block.key];
          const isMainCollapsed = collapsedMainGroups[block.gKey];
          const showGKeyHeader = filterGroup === 'All' && (index === 0 || block.gKey !== currentBlocks[index - 1].gKey);

          return (
            <div key={block.key} style={{ marginBottom: isMainCollapsed ? (showGKeyHeader ? '1.5rem' : '0') : '3rem' }}>
              {showGKeyHeader && (
                <div
                  onClick={() => toggleMainCollapse(block.gKey)}
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', borderBottom: '2px solid #C2B0B4', paddingBottom: '0.5rem', marginBottom: isMainCollapsed ? '0' : '1.5rem', transition: 'opacity 0.2s', userSelect: 'none' }}
                  onMouseOver={e => e.currentTarget.style.opacity = 0.7}
                  onMouseOut={e => e.currentTarget.style.opacity = 1}
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
                    onMouseOver={e => e.currentTarget.style.opacity = 0.7}
                    onMouseOut={e => e.currentTarget.style.opacity = 1}
                  >
                    <h3 style={{ margin: 0, textAlign: 'left', fontSize: '1rem', color: '#8D6E73', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {block.subKey} <span style={{ color: '#6A585B', fontWeight: '400', fontSize: '0.85rem', textTransform: 'none' }}>— {block.items.length} items</span>
                    </h3>
                    <div style={{ marginLeft: '0.75rem', backgroundColor: '#C2B0B4', color: '#312527', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      {isCollapsed ? 'SHOW ▼' : 'HIDE ▲'}
                    </div>
                  </div>
                  <div style={{ marginTop: '1rem', display: isCollapsed ? 'none' : 'block' }}>
                    <MerchGrid items={block.items} />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #C2B0B4' }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '0.5rem 1rem', backgroundColor: page === 1 ? '#C2B0B4' : '#8D6E73', color: page === 1 ? '#6A585B' : '#FFF', border: 'none', borderRadius: '6px', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>Previous</button>
            <span style={{ color: '#312527', fontWeight: '600', fontSize: '0.95rem' }}>Page {page} of {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '0.5rem 1rem', backgroundColor: page === totalPages ? '#C2B0B4' : '#8D6E73', color: page === totalPages ? '#6A585B' : '#FFF', border: 'none', borderRadius: '6px', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>Next</button>
          </div>
        )}
      </>
    );
  };

  const MerchGrid = ({ items }) => (
    <div className="merch-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1.2rem', marginTop: '1rem' }}>
      {items.map(item => {
        const isPhotocard = (item.category || "").toLowerCase() === 'photocard';
        const hasBackprint = isPhotocard && item.backImageUrl;
        const fitStyle = isPhotocard ? 'cover' : 'contain';
        const positionStyle = isPhotocard ? 'top' : 'center';
        const innerBgColor = isPhotocard ? 'transparent' : '#FFFFFF';
        const isFavorited = item.isFavorite === true;

        return (
          <div key={item.id} className="merch-card" style={{ borderRadius: '12px', backgroundColor: '#D4C4C7', boxShadow: '0 4px 12px rgba(49,37,39,0.1)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer', width: '100%', aspectRatio: '63 / 100', padding: '0.6rem', boxSizing: 'border-box', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

              {hasBackprint ? (
                <div className="flip-container" style={{ width: '100%', height: '100%' }}>
                  <div className="flipper" style={{ width: '100%', height: '100%' }}>
                    <div className="front" style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                      <img src={item.imageUrl} alt={item.customName} style={{ width: '100%', height: '100%', objectFit: fitStyle, display: 'block' }} />
                    </div>
                    <div className="back" style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                      <img src={item.backImageUrl} alt={`${item.customName} back`} style={{ width: '100%', height: '100%', objectFit: fitStyle, display: 'block' }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: innerBgColor }}>
                  <img src={item.imageUrl} alt={item.customName} style={{ width: '100%', height: '100%', objectFit: fitStyle, display: 'block' }} />
                </div>
              )}

              {/* Status badge */}
              {(item.status === 'owned' || item.status === 'on the way') && (
                <span style={{ position: 'absolute', top: '14px', left: '14px', backgroundColor: item.status === 'owned' ? 'rgba(49,37,39,0.75)' : 'rgba(141,110,115,0.85)', color: '#FFFFFF', fontSize: '0.6rem', fontWeight: '700', padding: '2px 7px', borderRadius: '20px', letterSpacing: '0.08em', textTransform: 'uppercase', zIndex: 10 }}>
                  {item.status === 'owned' ? 'Owned' : 'OTW'}
                </span>
              )}

              {/* Heart badge for favorited */}
              {isFavorited && (
                <span style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#8D6E73', boxShadow: '0 1px 4px rgba(49,37,39,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#F9F6F0" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </span>
              )}
            </div>

            <div style={{ padding: '0.2rem 0.6rem 0.8rem 0.6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flexGrow: 1, gap: '0.1rem' }}>
              <span style={{ fontSize: '0.65rem', color: '#8D6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold' }}>{item.category}</span>
              <h4 style={{ margin: '0.1rem 0 0 0', fontSize: '1.1rem', color: '#312527', fontWeight: '700', cursor: 'pointer', lineHeight: '1.2' }} onClick={() => setSelectedItem(item)}>{item.memberName}</h4>
              <p style={{ margin: '0 0 0.4rem 0', color: '#6A585B', fontSize: '0.85rem' }}>{item.groupName}{item.era ? ` • ${item.era}` : ''}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const overlayStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(49,37,39,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 'bold', cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s', zIndex: 10 };

  if (loading) return <p style={{ textAlign: 'center', color: '#6A585B' }}>Loading profile...</p>;

  return (
    <div style={{ width: '100%', paddingBottom: '3rem', textAlign: 'left' }}>
      
      {/* Styles for hover and flip animations */}
      <style>{`
        .merch-card { transition: transform 0.2s ease, box-shadow 0.2s ease !important; }
        .merch-card:hover { transform: translateY(-6px); box-shadow: 0 8px 16px rgba(49, 37, 39, 0.15) !important; z-index: 10; }
        .flip-container { perspective: 1000px; width: 100%; height: 100%; cursor: pointer; aspect-ratio: 63 / 100; }
        .flipper { transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1); transform-style: preserve-3d; position: relative; width: 100%; height: 100%; }
        .flip-container:hover .flipper { transform: rotateY(180deg); }
        .front, .back { backface-visibility: hidden; position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; }
        .back { transform: rotateY(180deg); }
        .custom-scroll::-webkit-scrollbar { width: 8px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }
        .theme-input { transition: box-shadow 0.2s ease; }
        .theme-input:focus, .theme-date-picker:focus-within { box-shadow: 0 0 0 2px #E6DADD, 0 0 0 4px #8D6E73 !important; outline: none; }
        input[type="month"]::-webkit-calendar-picker-indicator { position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; padding: 0; opacity: 0; cursor: pointer; }

        @media (max-width: 768px) {
          .profile-banner-container { height: 150px !important; margin-bottom: 3.5rem !important; }
          .profile-avatar-container { width: 100px !important; height: 100px !important; bottom: -50px !important; left: 50% !important; transform: translateX(-50%); }
          
          .profile-info { text-align: center !important; }
          .profile-title { padding-right: 0 !important; text-align: center !important; }
          
          .edit-profile-form { margin: 0 auto !important; }

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

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />

      {imageToCrop && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(49,37,39,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '80%', height: '60%', backgroundColor: '#D4C4C7' }}>
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={croppingField === 'avatarUrl' ? 1 : 1000/250} 
              cropShape={croppingField === 'avatarUrl' ? 'round' : 'rect'}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', width: '80%', maxWidth: '400px' }}>
            <span style={{ color: '#E6DADD' }}>Zoom:</span>
            <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button onClick={handleSaveCrop} style={{ padding: '0.8rem 2rem', backgroundColor: '#8D6E73', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Crop & Apply</button>
            <button onClick={() => { setImageToCrop(null); setCroppingField(null); }} style={{ padding: '0.8rem 2rem', backgroundColor: '#C2B0B4', color: '#312527', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="profile-banner-container" style={{ position: 'relative', marginBottom: '4rem', height: '250px', backgroundColor: '#D4C4C7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', borderRadius: '12px', backgroundColor: '#C2B0B4' }}>
          <img key={isEditing ? editForm.bannerUrl : profileData.bannerUrl} src={isEditing ? editForm.bannerUrl : profileData.bannerUrl} alt="Banner" onError={(e) => handleImageError(e, defaultBanner)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {isEditing && (
              <div style={{ ...overlayStyle, gap: '8px' }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0} onClick={() => handleImageClick('banner')}>
                  <img src="/cam.svg" alt="cam" width="20" height="20" /><span>Change Banner</span>
              </div>
          )}
          {isEditing && editForm.bannerUrl && editForm.bannerUrl !== defaultBanner && (
            <button
              className="del-btn"
              onClick={(e) => { e.stopPropagation(); setEditForm(prev => ({ ...prev, bannerUrl: defaultBanner })); }}
              style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(49,37,39,0.65)', backdropFilter: 'blur(4px)', color: 'white', border: 'none', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', zIndex: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s' }}
              title="Remove Banner"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          )}
        </div>

        {/* Global Edit Button */}
        {user && !isEditing && (
          <button 
            onClick={() => setIsEditing(true)} 
            style={{ 
              position: 'absolute', right: '1rem', top: '1rem', 
              padding: '0.5rem 1.2rem', backgroundColor: 'rgba(230, 218, 221, 0.8)', backdropFilter: 'blur(4px)', 
              border: 'none', borderRadius: '6px', color: '#312527', 
              cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap', zIndex: 30 
            }}
          >
            Edit Profile
          </button>
        )}
        
        <div style={{ position: 'absolute', bottom: '-60px', left: '1rem', zIndex: 20 }}>
          <div className="profile-avatar-container" style={{ width: '120px', height: '120px', borderRadius: '50%', border: '4px solid #E6DADD', backgroundColor: '#E6DADD', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
            <img key={isEditing ? editForm.avatarUrl : profileData.avatarUrl} src={isEditing ? editForm.avatarUrl : profileData.avatarUrl} alt="Avatar" onError={(e) => handleImageError(e, defaultAvatar)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {isEditing && (
              <div style={{ ...overlayStyle, fontSize: '0.8rem', textAlign: 'center', flexDirection: 'column', gap: '0px' }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0} onClick={() => handleImageClick('avatar')}>
                <img src="cam.svg" alt="cam" width="20" height="20"/><span>Change Icon</span>
              </div>
            )}
          </div>
          {isEditing && editForm.avatarUrl && editForm.avatarUrl !== defaultAvatar && (
            <button
              className="del-btn"
              onClick={(e) => { e.stopPropagation(); setEditForm(prev => ({ ...prev, avatarUrl: defaultAvatar })); }}
              style={{ position: 'absolute', top: '0px', right: '0px', backgroundColor: '#8D6E73', border: '2px solid #E6DADD', color: 'white', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s', padding: 0 }}
              title="Remove Avatar"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>
      </div>

      <div className="profile-info" style={{ padding: '0 1rem', marginBottom: '3rem', position: 'relative' }}>
        {isEditing ? (
          <div className="edit-profile-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px' }}>
            <p style={{ color: '#6A585B', margin: 0, fontSize: '0.9rem' }}><em>Click your avatar or banner above to upload an image.</em></p>
            <input type="text" placeholder="Display Name" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#C2B0B4', color: '#312527', border: 'none', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            <input type="text" placeholder="Bio" value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#C2B0B4', color: '#312527', border: 'none', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button onClick={handleSaveProfile} onMouseEnter={() => setHoveredButton('save')} onMouseLeave={() => setHoveredButton(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: hoveredButton === 'save' ? '#6B5458' : '#8D6E73', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'background-color 0.2s', flex: 1 }}>Save</button>
              <button onClick={() => { setIsEditing(false); setEditForm(profileData); }} onMouseEnter={() => setHoveredButton('cancel')} onMouseLeave={() => setHoveredButton(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: hoveredButton === 'cancel' ? '#D4C4C7' : 'transparent', color: '#6A585B', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', transition: 'background-color 0.2s', flex: 1 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="profile-title" style={{ margin: '0 0 0.4rem 0', color: '#312527', fontSize: '1.5rem', fontWeight: '700' }}>{profileData.name}</h1>
            <p style={{ margin: '0', color: '#6A585B', fontSize: '0.95rem' }}>{profileData.bio}</p>
          </>
        )}
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', padding: '1.2rem', backgroundColor: '#D4C4C7', borderRadius: '10px', boxShadow: '0 2px 8px rgba(49,37,39,0.08)' }}>
        <CustomSelect value={filterGroup === 'All' ? '' : filterGroup} onChange={(val) => handleGroupChange(val)} options={uniqueGroupNames.map(g => ({ value: g, label: g }))} placeholder="All Groups" style={{ flex: '0 0 auto', minWidth: '140px', fontWeight: 'bold' }} />
        <input type="text" placeholder="Search your collection..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="theme-input" style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', color: '#312527', fontSize: '0.95rem', outline: 'none', minWidth: 0 }} />
        <button onClick={resetFilters} style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: 'transparent', color: '#8D6E73', border: '2px solid #8D6E73', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', whiteSpace: 'nowrap' }}>Reset</button>
        <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ padding: '0.5rem 1.2rem', cursor: 'pointer', backgroundColor: showAdvanced ? '#8D6E73' : '#C2B0B4', color: showAdvanced ? '#FFF' : '#312527', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>{showAdvanced ? 'Hide Filters' : 'Advanced Filters'}</button>
      </div>

      {showAdvanced && (
        <div className="adv-filters" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem', padding: '1rem', backgroundColor: '#E6DADD', borderRadius: '10px', border: '1px solid #D4C4C7' }}>
          <CustomSelect value={filterCategory} onChange={setFilterCategory} options={uniqueCategories.map(cat => ({ value: cat, label: cat === 'All' ? 'All Types' : cat }))} placeholder="All Types" style={{ flex: 1, minWidth: '120px' }} />
          <CustomSelect value={filterEra} onChange={setFilterEra} options={uniqueEras.map(era => ({ value: era, label: era === 'All' ? 'All Eras' : era }))} placeholder="All Eras" style={{ flex: 1, minWidth: '120px' }} />
          <CustomSelect value={filterMember} onChange={setFilterMember} options={uniqueMembers.map(member => ({ value: member, label: member === 'All' ? 'All Members' : member }))} placeholder="All Members" style={{ flex: 1, minWidth: '120px' }} />
          
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
        <h2 className="gallery-title" style={{ fontSize: '1.3rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527', margin: 0, textAlign: 'center' }}>The Collection <span style={{ color: '#6A585B', fontWeight: '400', fontSize: '1rem' }}>({ownedCollection.length})</span></h2>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <CustomSelect value={groupBy} onChange={setGroupBy} options={[ { value: 'Member', label: 'Group By: Member' }, { value: 'Era', label: 'Group By: Era' } ]} placeholder="Group By: Member" dark style={{ minWidth: 'auto', flex: '0 0 auto' }} />
        </div>
      </div>
      {renderGroupedSection(ownedCollection, 'No matching items in collection.', 'owned')}

      <div className="gallery-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '1px solid #C2B0B4', paddingBottom: '0.5rem', marginBottom: '1.5rem', marginTop: '4rem' }}>
        <div className="left-spacer" />
        <h2 className="gallery-title" style={{ fontSize: '1.3rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527', margin: 0, textAlign: 'center' }}>Wishlist <span style={{ color: '#6A585B', fontWeight: '400', fontSize: '1rem' }}>({wishlistCollection.length})</span></h2>
        <div />
      </div>
      {renderGroupedSection(wishlistCollection, 'No matching items in wishlist.', 'wishlist')}
      
      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} user={user} />
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
    </div>
  );
}

const createImage = (url) => new Promise((resolve, reject) => { const image = new Image(); image.addEventListener('load', () => resolve(image)); image.addEventListener('error', (error) => reject(error)); if (!url.startsWith('data:') && !url.startsWith('blob:')) { image.setAttribute('crossOrigin', 'anonymous'); } image.src = url; });
async function getCroppedImg(imageSrc, pixelCrop, field) { const image = await createImage(imageSrc); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const targetWidth = field === 'bannerUrl' ? 1000 : 300; const targetHeight = field === 'bannerUrl' ? 250 : 300; canvas.width = targetWidth; canvas.height = targetHeight; ctx.drawImage( image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, targetWidth, targetHeight ); return canvas.toDataURL('image/jpeg', 0.8); }