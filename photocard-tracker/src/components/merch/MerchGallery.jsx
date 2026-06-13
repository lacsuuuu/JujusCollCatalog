import { useState, useEffect, useRef } from 'react';
import { useMerchGallery } from '../../hooks/useMerchGallery';
import GalleryFilters from './GalleryFilters';
import GalleryMerchGrid from './GalleryMerchGrid';
import ItemDetailModal from '../ui/ItemDetailModal';
import ThemeAlert from '../ui/ThemeAlert';
import { useUserProfile } from '../../hooks/useUserProfile';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../firebase';

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

  const [filterCategory, setFilterCategory] = useState('Photocard');
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterEra, setFilterEra] = useState('All');
  const [filterMember, setFilterMember] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [groupBy, setGroupBy] = useState('Member');

  // True database counts
  const [dbCategoryCounts, setDbCategoryCounts] = useState({});
  const [dbGroupedCounts, setDbGroupedCounts] = useState({});

  // Infinite Scroll Ref
  const loadMoreRef = useRef(null);

  const uniqueGroups = ['All', ...Array.from(new Set(groups.map(g => g.name).filter(Boolean))).sort()];
  const currentGroup = groups.find(g => g.name === filterGroup);

  const dbEras = currentGroup?.eras || [];
  const dbMembers = currentGroup?.members || [];

  // Use only groups collection data — no merch bleed-through
  const uniqueEras = ['All', ...dbEras.slice().sort()];
  const uniqueMembers = ['All', ...dbMembers.slice().sort()];
  const uniqueCategories = ['Photocard', 'Album', 'Lightstick', 'Postcard / Poster', 'Plushie / Toy', 'Other'];

  // FETCH TRUE DATABASE CATEGORY COUNTS (tab badges + grid header)
  useEffect(() => {
    const fetchDatabaseCounts = async () => {
      try {
        const counts = {};
        const merchRef = collection(db, 'merchandise');

        await Promise.all(uniqueCategories.map(async (cat) => {
          const constraints = [where('category', '==', cat)];
          if (filterGroup !== 'All') constraints.push(where('groupName', '==', filterGroup));
          if (filterEra !== 'All') constraints.push(where('era', '==', filterEra));
          if (filterMember !== 'All') constraints.push(where('memberName', '==', filterMember));

          const q = query(merchRef, ...constraints);
          const snapshot = await getCountFromServer(q);
          counts[cat] = snapshot.data().count;
        }));

        setDbCategoryCounts(counts);
      } catch (error) {
        console.error("Error fetching database counts:", error);
      }
    };

    fetchDatabaseCounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGroup, filterEra, filterMember]);

  // FETCH TRUE DATABASE GROUPED COUNTS (group/sub-group headers inside grid)
  useEffect(() => {
    const fetchGroupedCounts = async () => {
      try {
        const merchRef = collection(db, 'merchandise');
        const counts = {};

        if (filterGroup === 'All') {
          // Count per group name for the active category
          const groupNames = uniqueGroups.filter(g => g !== 'All');
          await Promise.all(groupNames.map(async (gName) => {
            const q = query(
              merchRef,
              where('category', '==', filterCategory),
              where('groupName', '==', gName)
            );
            const snap = await getCountFromServer(q);
            counts[gName] = snap.data().count;
          }));
        } else {
          // Derive subKeys from loaded items for this group+category,
          // rather than depending on dbMembers/dbEras being populated
          const field = groupBy === 'Member' ? 'memberName' : 'era';
          const loadedSubKeys = [...new Set(
            filteredMerch
              .filter(i => i.groupName === filterGroup && i.category === filterCategory)
              .map(i => i[field])
              .filter(Boolean)
          )];

          // Also include dbMembers/dbEras in case some aren't loaded yet
          const dbSubKeys = groupBy === 'Member' ? dbMembers : dbEras;
          const allSubKeys = [...new Set([...loadedSubKeys, ...dbSubKeys])];

          await Promise.all(allSubKeys.map(async (subKey) => {
            const constraints = [
              where('category', '==', filterCategory),
              where('groupName', '==', filterGroup),
              where(field, '==', subKey),
            ];
            if (filterEra !== 'All') constraints.push(where('era', '==', filterEra));
            if (filterMember !== 'All') constraints.push(where('memberName', '==', filterMember));
            const q = query(merchRef, ...constraints);
            const snap = await getCountFromServer(q);
            counts[subKey] = snap.data().count;
          }));
        }

        setDbGroupedCounts(counts);
      } catch (error) {
        console.error("Error fetching grouped counts:", error);
      }
    };

    fetchGroupedCounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGroup, filterCategory, filterEra, filterMember, groupBy, groups, filteredMerch]);

  // INFINITE SCROLL OBSERVER
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 } // Trigger when 10% of the target div is visible
    );

    observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMore, loadingMore, loadMore]);

  const handleGroupChange = (val) => {
    setFilterGroup(val);
    setFilterEra('All');
    setFilterMember('All');
  };

  const resetFilters = () => {
    setFilterCategory('Photocard');
    if (uniqueGroups.length > 0) setFilterGroup(uniqueGroups[0]);
    setFilterEra('All');
    setFilterMember('All');
    setSearchQuery('');
    setDateStart('');
    setDateEnd('');
  };

  // ACTIVE GRID DATA (client-side filtering for loaded items)
  const displayMerch = filteredMerch.filter(item => {
    const matchCategory = item.category === filterCategory;
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

  const getTabStyle = (tabName) => {
    const isActive = filterCategory === tabName;
    return {
      position: 'relative',
      padding: '0.5rem 1rem',
      cursor: 'pointer',
      background: isActive ? '#8D6E73' : 'transparent',
      border: isActive ? 'none' : '1px solid transparent',
      borderRadius: '8px',
      color: isActive ? '#FFF' : '#8D6E73',
      fontWeight: '600',
      fontSize: '0.82rem',
      letterSpacing: '0.01em',
      transition: 'all 0.18s ease',
      outline: 'none',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      flexShrink: 0,
    };
  };

  if (loading && filteredMerch.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#A08D90' }}>
        <div style={{
          display: 'inline-block',
          width: '32px',
          height: '32px',
          border: '2px solid #D4C4C7',
          borderTopColor: '#8D6E73',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '1rem'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '0.05em' }}>Loading gallery…</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>

      <GalleryFilters
        filterGroup={filterGroup}
        filterEra={filterEra}
        filterMember={filterMember}
        searchQuery={searchQuery}
        dateStart={dateStart}
        dateEnd={dateEnd}
        showAdvanced={showAdvanced}
        uniqueGroups={uniqueGroups}
        uniqueEras={uniqueEras}
        uniqueMembers={uniqueMembers}
        onGroupChange={handleGroupChange}
        setFilterEra={setFilterEra}
        setFilterMember={setFilterMember}
        setSearchQuery={setSearchQuery}
        setDateStart={setDateStart}
        setDateEnd={setDateEnd}
        setShowAdvanced={setShowAdvanced}
        resetFilters={resetFilters}
      />

      {/* Category tab strip — pill switcher in an inset tray */}
      <div style={{
        background: 'rgba(212, 196, 199, 0.25)',
        borderRadius: '12px',
        padding: '5px',
        marginBottom: '1.75rem',
        display: 'flex',
        overflowX: 'auto',
        gap: '2px',
        scrollbarWidth: 'none',
        boxShadow: 'inset 0 1px 3px rgba(49, 37, 39, 0.08)',
      }}>
        {uniqueCategories.map(cat => {
          const isActive = filterCategory === cat;
          const count = dbCategoryCounts[cat];
          return (
            <button key={cat} style={getTabStyle(cat)} onClick={() => setFilterCategory(cat)}>
              {cat}
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.22)' : 'rgba(141, 110, 115, 0.12)',
                color: isActive ? '#FFF' : '#8D6E73',
                padding: '0 6px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: '700',
                fontVariantNumeric: 'tabular-nums',
                minWidth: '20px',
                textAlign: 'center',
                lineHeight: '1.6',
              }}>
                {count !== undefined ? count : '–'}
              </span>
            </button>
          );
        })}
      </div>

      <GalleryMerchGrid
        items={displayMerch}
        user={user}
        userRole={profileData?.role}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        currentGroup={currentGroup}
        filterGroup={filterGroup}
        filteredCount={dbCategoryCounts[filterCategory] ?? 0}
        dbGroupedCounts={dbGroupedCounts}
        onSelectItem={setSelectedItem}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />

      {/* Invisible target div for Infinite Scroll */}
      {hasMore && (
        <div ref={loadMoreRef} style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem', padding: '1rem' }}>
          {loadingMore && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8D6E73', fontWeight: '600', fontSize: '0.88rem' }}>
              <span style={{
                display: 'inline-block',
                width: '18px',
                height: '18px',
                border: '2px solid #D4C4C7',
                borderTopColor: '#8D6E73',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Loading more items...
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(49, 37, 39, 0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: '#FAF6F7',
            padding: '2rem 2rem 1.75rem',
            borderRadius: '16px',
            textAlign: 'center',
            maxWidth: '380px',
            width: '100%',
            border: '1px solid rgba(212, 196, 199, 0.6)',
            boxShadow: '0 8px 32px rgba(49, 37, 39, 0.18)',
          }}>
            {/* Warning icon */}
            <div style={{
              width: '44px', height: '44px',
              background: 'rgba(184, 92, 92, 0.1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 6v5M10 13.5v.5" stroke="#B85C5C" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M8.485 2.929l-6.364 11a1.8 1.8 0 001.558 2.7h12.728a1.8 1.8 0 001.558-2.7l-6.364-11a1.8 1.8 0 00-3.116 0z" stroke="#B85C5C" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
            <h3 style={{ color: '#312527', margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '700' }}>Delete this item?</h3>
            <p style={{ color: '#6A585B', marginBottom: '1.75rem', fontSize: '0.875rem', lineHeight: '1.5' }}>
              This will permanently remove it from the global catalog. This can't be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: '0.55rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: '#6A585B',
                  border: '1.5px solid #C2B0B4',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteItem}
                style={{
                  padding: '0.55rem 1.5rem',
                  backgroundColor: '#B85C5C',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  transition: 'all 0.15s ease',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} user={user} userRole={profileData?.role} />
      <ThemeAlert message={alertMsg} onClose={() => setAlertMsg(null)} />
    </div>
  );
}