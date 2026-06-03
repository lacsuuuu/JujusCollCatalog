import { useState, useEffect } from 'react';
import CustomSelect from '../ui/CustomSelect';

const GROUPS_PER_PAGE = 5;

function GalleryMerchCard({ item, user, onSelect, onStatusChange, onDelete }) {
  const isPhotocard = (item.category || '').toLowerCase() === 'photocard';
  const hasBackprint = isPhotocard && item.backImageUrl;
  const fitStyle = isPhotocard ? 'cover' : 'contain';
  const positionStyle = isPhotocard ? 'top' : 'center';
  const innerBgColor = isPhotocard ? 'transparent' : '#FFFFFF';

  return (
    <div className="merch-card" style={{ borderRadius: '12px', backgroundColor: '#D4C4C7', boxShadow: '0 4px 12px rgba(49,37,39,0.1)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div onClick={() => onSelect(item)} style={{ cursor: 'pointer', width: '100%', aspectRatio: '1 / 1.4', padding: '0.6rem', boxSizing: 'border-box', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

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
        <h4 style={{ margin: '0.1rem 0 0 0', fontSize: '1.1rem', color: '#312527', fontWeight: '700', cursor: 'pointer', lineHeight: '1.2' }} onClick={() => onSelect(item)}>{item.memberName}</h4>
        <p style={{ margin: '0 0 0.4rem 0', color: '#6A585B', fontSize: '0.85rem' }}>{item.groupName}{item.era ? ` • ${item.era}` : ''}</p>

        {user && (
          <div style={{ width: '100%', marginTop: 'auto', paddingTop: '0.4rem' }}>
            <CustomSelect
              value={item.status}
              onChange={(val) => onStatusChange(item.id, val)}
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
            <button
              onClick={() => onDelete(item.id)}
              style={{ width: '100%', padding: '0.4rem', backgroundColor: 'transparent', color: '#A85A66', border: '1px solid #A85A66', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryGrid({ items, user, onSelect, onStatusChange, onDelete }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1.2rem' }}>
      {items.map(item => (
        <GalleryMerchCard
          key={item.id}
          item={item}
          user={user}
          onSelect={onSelect}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default function GalleryMerchGrid({
  items,
  user,
  groupBy,
  setGroupBy,
  currentGroup,
  filterGroup,
  filteredCount,
  onSelectItem,
  onStatusChange,
  onDelete,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [collapsedMainGroups, setCollapsedMainGroups] = useState({});

  useEffect(() => {
    setCurrentPage(1);
    setCollapsedGroups({});
    setCollapsedMainGroups({});
  }, [items, groupBy]);

  const toggleCollapse = (blockKey) =>
    setCollapsedGroups(prev => ({ ...prev, [blockKey]: !prev[blockKey] }));
  const toggleMainCollapse = (gKey) =>
    setCollapsedMainGroups(prev => ({ ...prev, [gKey]: !prev[gKey] }));

  const memberOrder = currentGroup?.members || [];
  const eraOrder = currentGroup?.eras || [];
  const subKeyOrder = groupBy === 'Era' ? memberOrder : eraOrder;

  const sortedSubKeys = (subKeys) => {
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

  const buildBlocks = () => {
    const groupedData = {};
    items.forEach(item => {
      const gKey = item.groupName || 'Unknown Group';
      const subKey = groupBy === 'Member'
        ? (item.memberName || 'Unknown Member')
        : (item.era || 'Unknown Era');
      if (!groupedData[gKey]) groupedData[gKey] = {};
      if (!groupedData[gKey][subKey]) groupedData[gKey][subKey] = [];
      groupedData[gKey][subKey].push(item);
    });

    const groupItemCounts = {};
    Object.keys(groupedData).forEach(gKey => {
      groupItemCounts[gKey] = Object.values(groupedData[gKey]).reduce((s, a) => s + a.length, 0);
    });

    const blocks = [];
    Object.keys(groupedData).sort().forEach(gKey => {
      sortedSubKeys(Object.keys(groupedData[gKey])).forEach(subKey => {
        groupedData[gKey][subKey].sort((a, b) => {
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

  const { blocks, groupItemCounts } = buildBlocks();
  const totalPages = Math.ceil(blocks.length / GROUPS_PER_PAGE);
  const currentBlocks = blocks.slice((currentPage - 1) * GROUPS_PER_PAGE, currentPage * GROUPS_PER_PAGE);

  return (
    <>
      {/* Gallery header */}
      <div className="gallery-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '1px solid #C2B0B4', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
        <div className="left-spacer" />
        <h2 className="gallery-title" style={{ fontSize: '1.3rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#312527', margin: 0, textAlign: 'center' }}>
          {filterGroup === 'All' ? 'All Groups' : filterGroup}{' '}
          <span style={{ color: '#6A585B', fontWeight: '400', fontSize: '1rem' }}>({filteredCount})</span>
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
                      <GalleryGrid
                        items={block.items}
                        user={user}
                        onSelect={onSelectItem}
                        onStatusChange={onStatusChange}
                        onDelete={onDelete}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #C2B0B4' }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '0.5rem 1rem', backgroundColor: currentPage === 1 ? '#C2B0B4' : '#8D6E73', color: currentPage === 1 ? '#6A585B' : '#FFF', border: 'none', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>Previous</button>
              <span style={{ color: '#312527', fontWeight: '600', fontSize: '0.95rem' }}>Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '0.5rem 1rem', backgroundColor: currentPage === totalPages ? '#C2B0B4' : '#8D6E73', color: currentPage === totalPages ? '#6A585B' : '#FFF', border: 'none', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>Next</button>
            </div>
          )}
        </>
      )}
    </>
  );
}