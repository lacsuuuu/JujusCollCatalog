import { useState, useEffect } from 'react';
import { useProfile } from '../../hooks/useProfile';
import ProfileHeader from './ProfileHeader';
import ProfileFilters from './ProfileFilters';
import ProfileMerchGrid from './ProfileMerchGrid';
import ItemDetailModal from '../ui/ItemDetailModal';
import ThemeAlert from '../ui/ThemeAlert';

const PROFILE_STYLES = `
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
    .gallery-header { display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: center !important; }
    .left-spacer { display: none !important; }
    .gallery-title { text-align: left !important; font-size: 1.1rem !important; margin: 0 !important; }
    .merch-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important; }
  }
`;

export default function Profile({ user }) {
  const {
    merch, groups, loading, profileData, alertMsg, setAlertMsg,
    saveProfile, defaultAvatar, defaultBanner,
  } = useProfile();

  const [selectedItem, setSelectedItem] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(profileData);

  // Keep editForm in sync when profileData loads from Firestore
  useEffect(() => { setEditForm(profileData); }, [profileData]);

  const [filterCategory, setFilterCategory] = useState('All');
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterEra, setFilterEra] = useState('All');
  const [filterMember, setFilterMember] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [groupBy, setGroupBy] = useState('Member');

  // Derived filter options
  const uniqueGroupNames = groups.map(g => g.name).filter(Boolean).sort();
  const sortedGroupsByCount = [...uniqueGroupNames].sort((a, b) =>
    merch.filter(i => i.groupName === b).length - merch.filter(i => i.groupName === a).length
  );

  // Auto-select the top group on load
  useEffect(() => {
    if (!loading && filterGroup === 'All' && sortedGroupsByCount.length > 0) {
      setFilterGroup(sortedGroupsByCount[0]);
    }
  }, [loading, sortedGroupsByCount[0]]);

  const currentGroup = groups.find(g => g.name === filterGroup);
  const dbEras = currentGroup?.eras || [];
  const dbMembers = currentGroup?.members || [];
  const activeMerch = merch.filter(i => i.groupName === filterGroup);

  const uniqueEras = ['All', ...[...new Set([...dbEras, ...activeMerch.map(i => i.era)].filter(Boolean))].sort()];
  const uniqueMembers = ['All', ...[...new Set([...dbMembers, ...activeMerch.map(i => i.memberName)].filter(Boolean))].sort()];
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

  const filteredMerch = merch.filter(item => {
    const matchCategory = filterCategory === 'All' || item.category === filterCategory;
    const matchGroup = filterGroup === 'All' || item.groupName === filterGroup;
    const matchEra = filterEra === 'All' || item.era === filterEra;
    const matchMember = filterMember === 'All' || item.memberName === filterMember;
    const searchLower = searchQuery.toLowerCase();
    const matchSearch =
      (item.customName || '').toLowerCase().includes(searchLower) ||
      (item.groupName || '').toLowerCase().includes(searchLower) ||
      (item.memberName || '').toLowerCase().includes(searchLower);

    let matchDate = true;
    if (dateStart || dateEnd) {
      if (!item.releaseDate) {
        matchDate = false;
      } else {
        const itemDate = item.releaseDate?.toDate ? item.releaseDate.toDate() : new Date(item.releaseDate);
        if (dateStart && itemDate < new Date(dateStart + '-01T00:00:00Z')) matchDate = false;
        if (dateEnd) {
          const [y, m] = dateEnd.split('-');
          if (itemDate > new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))) matchDate = false;
        }
      }
    }
    return matchCategory && matchGroup && matchEra && matchMember && matchSearch && matchDate;
  });

  const ownedCollection = filteredMerch.filter(i => i.status === 'owned' || i.status === 'on the way');
  const wishlistCollection = filteredMerch.filter(i => i.status === 'wishlisted');

  const handleSaveProfile = async () => {
    const ok = await saveProfile(editForm);
    if (ok) setIsEditing(false);
  };

  if (loading) return <p style={{ textAlign: 'center', color: '#6A585B' }}>Loading profile...</p>;

  return (
    <div style={{ width: '100%', paddingBottom: '3rem', textAlign: 'left' }}>
      <style>{PROFILE_STYLES}</style>

      <ProfileHeader
        user={user}
        profileData={profileData}
        editForm={editForm}
        setEditForm={setEditForm}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        defaultAvatar={defaultAvatar}
        defaultBanner={defaultBanner}
      />

      {/* Profile info / edit form */}
      <div className="profile-info" style={{ padding: '0 1rem', marginBottom: '3rem', position: 'relative' }}>
        {isEditing ? (
          <div className="edit-profile-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px' }}>
            <p style={{ color: '#6A585B', margin: 0, fontSize: '0.9rem' }}><em>Click your avatar or banner above to upload an image.</em></p>
            <input type="text" placeholder="Display Name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#C2B0B4', color: '#312527', border: 'none', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            <input type="text" placeholder="Bio" value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#C2B0B4', color: '#312527', border: 'none', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
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

      <ProfileFilters
        filterGroup={filterGroup}
        filterCategory={filterCategory}
        filterEra={filterEra}
        filterMember={filterMember}
        searchQuery={searchQuery}
        dateStart={dateStart}
        dateEnd={dateEnd}
        showAdvanced={showAdvanced}
        uniqueGroupNames={uniqueGroupNames}
        uniqueCategories={uniqueCategories}
        uniqueEras={uniqueEras}
        uniqueMembers={uniqueMembers}
        onGroupChange={handleGroupChange}
        setFilterCategory={setFilterCategory}
        setFilterEra={setFilterEra}
        setFilterMember={setFilterMember}
        setSearchQuery={setSearchQuery}
        setDateStart={setDateStart}
        setDateEnd={setDateEnd}
        setShowAdvanced={setShowAdvanced}
        resetFilters={resetFilters}
      />

      <ProfileMerchGrid
        items={ownedCollection}
        emptyMsg="No matching items in collection."
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        currentGroup={currentGroup}
        filterGroup={filterGroup}
        showGroupByControl
        onSelectItem={setSelectedItem}
      />

      <div style={{ marginTop: '4rem' }}>
        <ProfileMerchGrid
          items={wishlistCollection}
          emptyMsg="No matching items in wishlist."
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          currentGroup={currentGroup}
          filterGroup={filterGroup}
          onSelectItem={setSelectedItem}
        />
      </div>

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} user={user} />
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
    </div>
  );
}