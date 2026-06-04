import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, getDocs, limit, startAfter } from 'firebase/firestore';

export function useMerchGallery(userId) {
  const [merch, setMerch] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Pagination States
  const [globalMerch, setGlobalMerch] = useState([]);
  const [collectedLinks, setCollectedLinks] = useState([]);
  const [lastDoc, setLastDoc] = useState(null); 
  const [hasMore, setHasMore] = useState(true); 
  const [loadingMore, setLoadingMore] = useState(false);

  // 1. Initial Fetch (First 20 items)
  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    // Fetch the first 20 items using getDocs instead of onSnapshot
    const fetchInitialMerch = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'merchandise'), orderBy('addedAt', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          setGlobalMerch(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          // Save the very last document to use as our starting point for the next batch
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(snapshot.docs.length === 20); // If we got 20, there might be more
        } else {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Error fetching merch:", error);
      }
      setLoading(false);
    };

    fetchInitialMerch();
    
    let unsubCollected = () => {};
    if (userId) {
      console.log("Attempting to listen to user:", userId);
      const collectedRef = collection(db, 'profile', userId, 'collected_items');
      
      unsubCollected = onSnapshot(collectedRef, (snapshot) => {
        // FIXED: Inject the document ID as merchId
        setCollectedLinks(snapshot.docs.map(d => ({ 
          ...d.data(),
          merchId: d.id 
        })));
      });
    } else {
       setCollectedLinks([]);
    }

    return () => { unsubGroups(); unsubCollected(); };
  }, [userId]);

  // 2. Load More Function (Next 20 items)
  const loadMore = async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);

    try {
      const q = query(
        collection(db, 'merchandise'), 
        orderBy('addedAt', 'desc'), 
        startAfter(lastDoc), 
        limit(20)
      );
      
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        setGlobalMerch(prev => [...prev, ...snapshot.docs.map(d => ({ id: d.id, ...d.data() }))]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 20);
      } else {
        setHasMore(false); 
      }
    } catch (error) {
      console.error("Error loading more merch:", error);
    }
    
    setLoadingMore(false);
  };

  // 3. Merge Effect (Unchanged)
  useEffect(() => {
    if (globalMerch.length > 0) {
      const mergedMerch = globalMerch.map(item => {
        const link = collectedLinks.find(c => c.merchId === item.id);
        return { ...item, status: link ? link.status : 'unowned' };
      });
      setMerch(mergedMerch);
    } else if (globalMerch.length === 0) {
      setMerch([]);
    }
  }, [globalMerch, collectedLinks]);

  // 4. Status and Delete Handlers (Unchanged)
  const handleStatusChange = async (itemId, newStatus) => {
   if (!userId || userId === 'undefined') {
      setAlertMsg("You must be fully logged in to update your collection.");
      return;
    }
    try {
      const itemRef = doc(db, "profile", userId, 'collected_items', itemId);

      if (newStatus === 'unowned') {
        await deleteDoc(itemRef);
      } else {
        await setDoc(itemRef, {
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
      await deleteDoc(doc(db, 'merchandise', confirmDelete));
      setGlobalMerch(prev => prev.filter(item => item.id !== confirmDelete));
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
  };
}