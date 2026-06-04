import CustomSelect from '../ui/CustomSelect';

export default function GalleryFilters({
  filterGroup,
  filterCategory,
  filterEra,
  filterMember,
  searchQuery,
  dateStart,
  dateEnd,
  showAdvanced,
  uniqueGroups,
  uniqueCategories,
  uniqueEras,
  uniqueMembers,
  onGroupChange,
  setFilterCategory,
  setFilterEra,
  setFilterMember,
  setSearchQuery,
  setDateStart,
  setDateEnd,
  setShowAdvanced,
  resetFilters,
}) {
  const formatMMYYYY = (val) => val ? `${val.split('-')[1]}/${val.split('-')[0]}` : 'MM/YYYY';

  return (
    <>
      <div className="filter-bar" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', padding: '1.2rem', backgroundColor: '#D4C4C7', borderRadius: '10px', boxShadow: '0 2px 8px rgba(49,37,39,0.08)' }}>
        <CustomSelect
          value={filterGroup}
          onChange={onGroupChange}
          options={uniqueGroups.map(g => ({ value: g, label: g === 'All' ? 'All Groups' : g }))}
          placeholder="All Groups"
          style={{ flex: '0 0 auto', minWidth: '140px', fontWeight: 'bold' }}
        />
        <input
          type="text"
          className="theme-input"
          placeholder="Search member, custom name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#C2B0B4', color: '#312527', fontSize: '0.95rem', outline: 'none' }}
        />
        <button
          onClick={resetFilters}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: 'transparent', color: '#8D6E73', border: '2px solid #8D6E73', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600' }}
        >
          Reset
        </button>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ padding: '0.5rem 1.2rem', cursor: 'pointer', backgroundColor: showAdvanced ? '#8D6E73' : '#C2B0B4', color: showAdvanced ? '#FFF' : '#312527', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s' }}
        >
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
            style={{  flex: 1, 
                      minWidth: '120px',
                      opacity: filterGroup === 'All' ? 0.4 : 1,
                      pointerEvents: filterGroup === 'All' ? 'none' : 'auto',
                      transition: 'opacity 0.2s'
            }}
          />
          <CustomSelect
            value={filterMember}
            onChange={setFilterMember}
            options={uniqueMembers.map(member => ({ value: member, label: member === 'All' ? 'All Members' : member }))}
            placeholder="All Members"
            style={{  flex: 1, 
                      minWidth: '120px',
                      opacity: filterGroup === 'All' ? 0.4 : 1,
                      pointerEvents: filterGroup === 'All' ? 'none' : 'auto',
                      transition: 'opacity 0.2s' }}
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

            <svg style={{ pointerEvents: 'none', marginLeft: '0.2rem' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
        </div>
      )}
    </>
  );
}