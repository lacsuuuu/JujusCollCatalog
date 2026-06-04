import { useState, useEffect } from 'react';
import { useMerchGallery } from '../../hooks/useMerchGallery';
import GalleryFilters from './GalleryFilters';
import GalleryMerchGrid from './GalleryMerchGrid';
import ItemDetailModal from '../ui/ItemDetailModal';
import ThemeAlert from '../ui/ThemeAlert';
import { useUserProfile } from '../../hooks/useUserProfile';

const GALLERY_STYLES = `
  .merch-card { transition: transform 0.2s ease, box-shadow 0.2s ease !important; }
  .merch-card:hover { transform: translateY(-6px); box-shadow: 0 8px 16px rgba(49, 37, 39, 0.15) !important; z-index: 10; }
  .flip-container { perspective: 1000px; width: 100%; height: 100%; cursor: pointer; aspect-ratio: 63 / 100; }
  .flipper { transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1); transform-style: preserve-3d; position: relative; width: 100%; height: 100%; }
  .flip-container:hover .flipper { transform: rotateY(180deg); }
  .front, .back { backface-visibility: hidden; position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; }
  .back { transform: rotateY(180deg); }
  .theme-input, .theme-select { transition: box-shadow 0.2s ease; }
  .theme-input:focus, .theme-select:focus, .theme-date-picker:focus-within { box-shadow: 0 0 0 2px #E6DADD, 0 0 0 4px #8D6E73 !important; outline: none; }
  .custom-scroll::-webkit-scrollbar { width: 8px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #C2B0B4; border-radius: 4px; }
  .custom-scroll::-webkit-scrollbar-thumb:hover { background: #8D6E73; }
  input[type="month"]::-webkit-calendar-picker-indicator { position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; padding: 0; opacity: 0; cursor: pointer; }

  @media (max-width: 768px) {
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

export default function MerchGallery({ user }) {
  // CRITICAL FIX: Pass the user's UID down to sync personal collection links
  const {
    merch, groups, loading, alertMsg, setAlertMsg,
    confirmDelete, setConfirmDelete,
    handleStatusChange, handleDelete, confirmDeleteItem,
  } = useMerchGallery(user?.uid);

  const { profileData } = useUserProfile(user?.uid);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterEra, setFilterEra] = useState('All');
  const [filterMember, setFilterMember] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState('Member');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const uniqueGroups = ['All', ...Array.from(new Set(groups.map(g => g.name).filter(Boolean))).sort()];
  const currentGroup = filterGroup !== 'All' ? groups.find(g => g.name === filterGroup) : null;
  const uniqueEras = ['All', ...(currentGroup?.eras || [])];
  const uniqueMembers = ['All', ...(currentGroup?.members || [])];
  const uniqueCategories = ['All', 'Photocard', 'Album', 'Lightstick', 'Postcard / Poster', 'Plushie / Toy', 'Other'];

  const handleGroupChange = (newGroup) => {
    setFilterGroup(newGroup);
    setFilterCategory('All');
    setFilterEra('All');
    setFilterMember('All');
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

  const groupMerch = filterGroup === 'All' ? merch : merch.filter(i => i.groupName === filterGroup);

  const filteredMerch = groupMerch.filter(item => {
    const matchCategory = filterCategory === 'All' || item.category === filterCategory;
    const matchEra = filterEra === 'All' || item.era === filterEra;
    const matchMember = filterMember === 'All' || item.memberName === filterMember;
    const searchLower = searchQuery.toLowerCase();
    const matchSearch =
      (item.customName || '').toLowerCase().includes(searchLower) ||
      (item.memberName || '').toLowerCase().includes(searchLower);

    let matchDate = true;
    if (dateStart || dateEnd) {
      if (!item.releaseDate) {
        matchDate = false;
      } else {
        const itemDate = item.releaseDate.toDate ? item.releaseDate.toDate() : new Date(item.releaseDate);
        if (dateStart && itemDate < new Date(dateStart + '-01T00:00:00Z')) matchDate = false;
        if (dateEnd) {
          const [y, m] = dateEnd.split('-');
          if (itemDate > new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))) matchDate = false;
        }
      }
    }
    return matchCategory && matchEra && matchMember && matchSearch && matchDate;
  });

  if (loading) return <p style={{ textAlign: 'center', color: '#6A585B', fontSize: '0.9rem' }}>Loading collection...</p>;

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      <style>{GALLERY_STYLES}</style>
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(49,37,39,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#E6DADD', padding: '1.5rem 2rem', borderRadius: '12px', border: '1px solid #D4C4C7', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '320px', width: '90%' }}>
            <p style={{ color: '#312527', margin: '0 0 1.5rem 0', fontWeight: '600' }}>Are you sure you want to remove this item?</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={confirmDeleteItem} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#8D6E73', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: 'transparent', color: '#8D6E73', border: '1px solid #8D6E73', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <GalleryFilters
        filterGroup={filterGroup}
        filterCategory={filterCategory}
        filterEra={filterEra}
        filterMember={filterMember}
        searchQuery={searchQuery}
        dateStart={dateStart}
        dateEnd={dateEnd}
        showAdvanced={showAdvanced}
        uniqueGroups={uniqueGroups}
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

      <GalleryMerchGrid
        items={filteredMerch}
        user={user}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        currentGroup={currentGroup}
        filterGroup={filterGroup}
        filteredCount={filteredMerch.length}
        onSelectItem={setSelectedItem}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} user={user} userRole={profileData?.role} />
    </div>
  );
}