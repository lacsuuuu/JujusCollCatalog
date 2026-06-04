import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export function useUserProfile(uid) {
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    // If no one is logged in, reset and stop loading
    if (!uid) {
      setProfileData(null);
      setLoadingProfile(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'profile', uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfileData(docSnap.data());
        } else {
          // Fallback just in case a new user hasn't created a profile doc yet
          setProfileData({ role: 'user' }); 
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setProfileData({ role: 'user' });
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [uid]);

  return { profileData, loadingProfile };
}