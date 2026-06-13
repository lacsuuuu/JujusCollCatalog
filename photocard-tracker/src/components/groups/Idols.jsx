import { useState } from 'react';
import GroupDirectory from './GroupDirectory';
import ArtistDirectory from './ArtistDirectory';
import GroupManager from './GroupManager';

export default function Idols({ user, canEdit }) {
  // Default to the groups view
  const [activeTab, setActiveTab] = useState('groups');

  const getTabStyle = (tabName) => ({
    padding: '0.75rem 1.5rem',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: activeTab === tabName ? '3px solid #8D6E73' : '3px solid transparent',
    color: activeTab === tabName ? '#312527' : '#6A585B',
    fontWeight: '700',
    fontSize: '1rem',
    transition: 'all 0.2s ease',
    outline: 'none'
  });

  return (
    <div style={{ width: '100%', paddingBottom: '3rem', textAlign: 'left', animation: 'fadeIn 0.3s' }}>
      
      {/* Horizontal Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(141, 110, 115, 0.2)', marginBottom: '2rem' }}>
        <button style={getTabStyle('groups')} onClick={() => setActiveTab('groups')}>
          Groups
        </button>
        <button style={getTabStyle('members')} onClick={() => setActiveTab('members')}>
          Members
        </button>
        {/* SECURITY: Only show the Manage tab if the user has edit permissions */}
        {canEdit && (
          <button style={getTabStyle('manage')} onClick={() => setActiveTab('manage')}>
            Manage
          </button>
        )}
      </div>

      {/* Render the selected component */}
      <div style={{ width: '100%' }}>
        {activeTab === 'groups' && <GroupDirectory />}
        {activeTab === 'members' && <ArtistDirectory user={user} />}
        {activeTab === 'manage' && canEdit && <GroupManager />}
      </div>
      
    </div>
  );
}