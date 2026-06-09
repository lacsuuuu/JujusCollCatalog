import { useState, useEffect } from 'react';
import { useMerchGallery } from '../../hooks/useMerchGallery';
import GalleryFilters from './GalleryFilters';
import GalleryMerchGrid from './GalleryMerchGrid';
import ItemDetailModal from '../ui/ItemDetailModal';
import ThemeAlert from '../ui/ThemeAlert';
import { useUserProfile } from '../../hooks/useUserProfile';

export default function MerchGallery({ user }) {
  const {
    merch: filteredMerch,
    groups,
    loading,
    hasMore,
    loadingMore,
    loadMore,
    alertMsg,
    setAlertMsg,
    confirmDelete,
    setConfirmDelete,
    handleStatusChange,
    handleDelete,
    confirmDeleteItem,
  } = useMerchGallery(user?.uid);

  const { profileData } = useUserProfile(user?.uid);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterEra, setFilterEra] = useState('All');
  const [filterMember, setFilterMember] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [groupBy, setGroupBy] = useState('Member');

  const uniqueGroups = ['All', ...Array.from(new Set(groups.map(g => g.name).filter(Boolean))).sort()];
  const currentGroup = groups.find(g => g.name === filterGroup);
  
  const activeMerch = filteredMerch.filter(i => i.groupName === filterGroup);
  const dbEras = currentGroup?.eras || [];
  const dbMembers = currentGroup?.members || [];
  
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
    if (uniqueGroups.length > 0) setFilterGroup(uniqueGroups[0]);
    setFilterEra('All');
    setFilterMember('All');
    setSearchQuery('');
    setDateStart('');
    setDateEnd('');
  };

  if (loading && filteredMerch.length === 0) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#6A585B' }}>Loading gallery...</div>;
  }

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      
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
        userRole={profileData?.role}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        currentGroup={currentGroup}
        filterGroup={filterGroup}
        filteredCount={filteredMerch.length}
        onSelectItem={setSelectedItem}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
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

      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(49, 37, 39, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#E6DADD', padding: '2rem', borderRadius: '12px', textAlign: 'center', maxWidth: '400px', border: '1px solid #D4C4C7', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#312527', margin: '0 0 1rem 0' }}>Confirm Deletion</h3>
            <p style={{ color: '#6A585B', marginBottom: '1.5rem' }}>Are you sure you want to permanently delete this item from the global database?</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={confirmDeleteItem} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#8D6E73', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#C2B0B4', color: '#312527', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} user={user} userRole={profileData?.role} />
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
    </div>
  );
}