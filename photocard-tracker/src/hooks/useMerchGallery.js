import { useState, useEffect } from 'react';
import { db } from '../firebase';
// Replaced updateDoc with setDoc and added where for querying
import { collection, onSnapshot, query, orderBy, where, doc, setDoc, deleteDoc } from 'firebase/firestore';

// 1. Added userId as a parameter so the hook knows whose collection to manage
export function useMerchGallery(userId) {
  const [merch, setMerch] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Separate states for the global pool and the user's specific links
  const [globalMerch, setGlobalMerch] = useState([]);
  const [collectedLinks, setCollectedLinks] = useState([]);

  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    // Fetch the pure global catalog
    const q = query(collection(db, 'merchandise'), orderBy('addedAt', 'desc'));
    const unsubMerch = onSnapshot(q, (snapshot) => {
      setGlobalMerch(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch the user's personal collected links
    let unsubCollected = () => {};
    if (userId) {
      const collectedQuery = query(collection(db, 'collected_items'), where('userId', '==', userId));
      unsubCollected = onSnapshot(collectedQuery, (snapshot) => {
        setCollectedLinks(snapshot.docs.map(d => d.data()));
      });
    } else {
       setCollectedLinks([]);
    }

    return () => { unsubGroups(); unsubMerch(); unsubCollected(); };
  }, [userId]);

  // 2. Merge effect: Combines global items with personal statuses
  useEffect(() => {
    if (globalMerch.length > 0) {
      const mergedMerch = globalMerch.map(item => {
        const link = collectedLinks.find(c => c.merchId === item.id);
        // If they have a link, use that status. Otherwise, default to 'unowned'
        return { ...item, status: link ? link.status : 'unowned' };
      });
      setMerch(mergedMerch);
      setLoading(false);
    } else if (globalMerch.length === 0) {
      setMerch([]);
      setLoading(false);
    }
  }, [globalMerch, collectedLinks]);

  // 3. Updated Status Handler: Writes to the junction collection instead of the master doc
  const handleStatusChange = async (itemId, newStatus) => {
    if (!userId) {
      setAlertMsg("You must be logged in to update your collection.");
      return;
    }
    
    try {
      // Create a unique composite key to prevent duplicates
      const linkId = `${userId}_${itemId}`;
      
      if (newStatus === 'unowned') {
        // If they un-claim it, delete the link document to save space
        await deleteDoc(doc(db, 'collected_items', linkId));
      } else {
        // Create or update the link document
        await setDoc(doc(db, 'collected_items', linkId), {
          userId: userId,
          merchId: itemId,
          status: newStatus,
          updatedAt: new Date()
        }, { merge: true });
      }
    } catch(e) {
      console.error(e);
      setAlertMsg('Failed to update status. Check permissions.');
    }
  };

  const handleDelete = (itemId) => setConfirmDelete(itemId);

  const confirmDeleteItem = async () => {
    try {
      // Note: This still attempts to delete the GLOBAL item. 
      // Your Firestore rules should restrict this so only the creator can successfully run this!
      await deleteDoc(doc(db, 'merchandise', confirmDelete));
    } catch {
      setAlertMsg('Failed to delete global item. Check permissions.');
    } finally {
      setConfirmDelete(null);
    }
  };

  return {
    merch,
    groups,
    loading,
    alertMsg,
    setAlertMsg,
    confirmDelete,
    setConfirmDelete,
    handleStatusChange,
    handleDelete,
    confirmDeleteItem,
  };
}