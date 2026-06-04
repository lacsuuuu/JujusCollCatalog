import { useState } from 'react';
import emailjs from '@emailjs/browser';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const BugIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2l1.5 1.5"/><path d="M14.5 3.5L16 2"/>
    <path d="M9 7.5A3 3 0 0 1 15 7.5V13a3 3 0 0 1-6 0V7.5z"/>
    <path d="M6.5 10H3"/><path d="M21 10h-3.5"/>
    <path d="M6.5 16.5l-2 2"/><path d="M19.5 18.5l-2-2"/>
    <path d="M6.5 7.5l-2-2"/><path d="M19.5 5.5l-2 2"/>
  </svg>
);

const MessageIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const CheckIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8D6E73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const MODAL_STYLES = `
  .feedback-overlay {
    position: fixed; inset: 0;
    background: rgba(49, 37, 39, 0.7);
    backdrop-filter: blur(4px);
    display: flex; justify-content: center; align-items: center;
    z-index: 99999; padding: 1rem;
  }
  .feedback-card {
    background: #E6DADD;
    border-radius: 16px;
    padding: 2rem;
    width: 100%; max-width: 460px;
    box-shadow: 0 20px 60px rgba(49, 37, 39, 0.25);
    position: relative;
  }
  .feedback-type-btn {
    flex: 1; padding: 0.6rem 1rem;
    border-radius: 8px; border: 1.5px solid #C2B0B4;
    background: transparent; color: #6A585B;
    font-weight: 600; font-size: 0.85rem;
    cursor: pointer; transition: all 0.2s;
    font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  }
  .feedback-type-btn.active {
    background: #8D6E73; border-color: #8D6E73; color: #fff;
  }
  .feedback-textarea {
    width: 100%; padding: 0.8rem 1rem;
    border-radius: 8px; border: 1.5px solid #D4C4C7;
    background: #fff; color: #312527;
    font-size: 0.9rem; font-family: inherit;
    resize: none; outline: none; box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
    line-height: 1.5;
  }
  .feedback-textarea:focus {
    border-color: #8D6E73;
    box-shadow: 0 0 0 3px rgba(141, 110, 115, 0.15);
  }
  .feedback-submit {
    width: 100%; padding: 0.75rem;
    background: #8D6E73; color: #fff;
    border: none; border-radius: 8px;
    font-weight: 700; font-size: 0.9rem;
    cursor: pointer; font-family: inherit;
    transition: background 0.2s;
  }
  .feedback-submit:disabled {
    background: #C2B0B4; cursor: not-allowed;
  }
  .feedback-submit:not(:disabled):hover {
    background: #7A5F64;
  }
`;

export default function FeedbackModal({ onClose, user }) {
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setLoading(true);

    try {
      await addDoc(collection(db, 'feedback'), {
        type,
        message: message.trim(),
        userId: user?.uid || null,
        username: user?.displayName || null,
        createdAt: new Date(),
      });

      const adminSnap = await getDocs(
        query(collection(db, 'profile'), where('role', '==', 'admin'))
      );
      const adminEmails = adminSnap.docs.map(d => d.data().email).filter(Boolean);

      await Promise.all(
        adminEmails.map(adminEmail =>
          emailjs.send(
            import.meta.env.VITE_EMAILJS_SERVICE_ID,
            import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
            {
              to_email: adminEmail,
              type: type === 'bug' ? 'Bug Report' : 'Feedback',
              username: user?.displayName || user?.email || 'Anonymous',
              email: user?.email || 'N/A',
              message: message.trim(),
            },
            import.meta.env.VITE_EMAILJS_PUBLIC_KEY
          )
        )
      );

      setDone(true);
    } catch (err) {
      console.error('Feedback error:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <style>{MODAL_STYLES}</style>
      <div className="feedback-card" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#8D6E73', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {done ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <CheckIcon size={40} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#312527', fontSize: '1.1rem', fontWeight: '700' }}>Thank you!</h3>
            <p style={{ margin: '0 0 1.5rem', color: '#6A585B', fontSize: '0.9rem' }}>Your {type === 'bug' ? 'bug report' : 'feedback'} has been sent.</p>
            <button onClick={onClose} className="feedback-submit" style={{ width: 'auto', padding: '0.6rem 2rem' }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              {type === 'bug' ? <BugIcon size={18} /> : <MessageIcon size={18} />}
              <h3 style={{ margin: 0, color: '#312527', fontSize: '1.1rem', fontWeight: '700' }}>
                {type === 'bug' ? 'Report a Bug' : 'Send Feedback'}
              </h3>
            </div>
            <p style={{ margin: '0 0 1.25rem', color: '#8D6E73', fontSize: '0.8rem' }}>
              We read every submission.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button className={`feedback-type-btn ${type === 'bug' ? 'active' : ''}`} onClick={() => setType('bug')}>
                <BugIcon size={14} /> Bug Report
              </button>
              <button className={`feedback-type-btn ${type === 'feedback' ? 'active' : ''}`} onClick={() => setType('feedback')}>
                <MessageIcon size={14} /> Feedback
              </button>
            </div>

            <textarea
              className="feedback-textarea"
              rows={5}
              placeholder={type === 'bug'
                ? 'Describe what happened and how to reproduce it...'
                : 'Share your thoughts, suggestions, or ideas...'}
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={1000}
            />
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#A08D90', marginBottom: '1rem' }}>
              {message.length}/1000
            </div>

            <button
              className="feedback-submit"
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
            >
              {loading ? 'Sending...' : 'Submit'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}