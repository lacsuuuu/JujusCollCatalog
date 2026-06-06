import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function useUserProfile(uid) {
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!uid) {
      setProfileData(null);
      setLoadingProfile(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'profile', uid),
      (docSnap) => {
        if (docSnap.exists()) {
          setProfileData(docSnap.data());
        } else {
          setProfileData({ role: 'user' });
        }
        setLoadingProfile(false);
      },
      (err) => {
        console.error('Error fetching profile:', err);
        setProfileData({ role: 'user' });
        setLoadingProfile(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { profileData, loadingProfile };
}