import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export function useMerchGallery() {
  const [merch, setMerch] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const q = query(collection(db, 'merchandise'), orderBy('addedAt', 'desc'));
    const unsubMerch = onSnapshot(q, (snapshot) => {
      setMerch(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => { unsubGroups(); unsubMerch(); };
  }, []);

  const handleStatusChange = async (itemId, newStatus) => {
    try {
      await updateDoc(doc(db, 'merchandise', itemId), { status: newStatus });
    } catch {
      setAlertMsg('Failed to update status.');
    }
  };

  const handleDelete = (itemId) => setConfirmDelete(itemId);

  const confirmDeleteItem = async () => {
    try {
      await deleteDoc(doc(db, 'merchandise', confirmDelete));
    } catch {
      setAlertMsg('Failed to delete.');
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