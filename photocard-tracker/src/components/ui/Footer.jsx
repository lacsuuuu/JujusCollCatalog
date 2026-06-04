import { useState } from 'react';
import FeedbackModal from './FeedbackModal';

const BugIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2l1.5 1.5"/><path d="M14.5 3.5L16 2"/>
    <path d="M9 7.5A3 3 0 0 1 15 7.5V13a3 3 0 0 1-6 0V7.5z"/>
    <path d="M6.5 10H3"/><path d="M21 10h-3.5"/>
    <path d="M6.5 16.5l-2 2"/><path d="M19.5 18.5l-2-2"/>
    <path d="M6.5 7.5l-2-2"/><path d="M19.5 5.5l-2 2"/>
  </svg>
);

export default function Footer({ user }) {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
      <footer style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '0.6rem 1rem',
        background: 'linear-gradient(to top, #E6DADD, rgba(230, 218, 221, 0.95))',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid #D4C4C7',
        zIndex: 500,
      }}>
        <button
          onClick={() => setShowFeedback(true)}
          style={{
            background: 'transparent',
            border: '1px solid #C2B0B4',
            borderRadius: '20px',
            padding: '0.35rem 1rem',
            color: '#8D6E73',
            fontSize: '0.78rem',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.02em',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#8D6E73';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = '#8D6E73';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#8D6E73';
            e.currentTarget.style.borderColor = '#C2B0B4';
          }}
        >
          <BugIcon />
          Report a bug / Give feedback
        </button>
      </footer>

      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} user={user} />
      )}
    </>
  );
}