import { useState } from 'react';
import { deleteField } from 'firebase/firestore';

export function useBinderDragDrop({ isEditing, activeBinder, currentPage, onUpdate, user }) {
  const [dragOverSlot, setDragOverSlot] = useState(null);

  const handleCollectionDragStart = (e, merchId) => {
    if (!isEditing) return;
    e.dataTransfer.setData('source', 'collection');
    e.dataTransfer.setData('merchId', merchId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleSlotDragStart = (e, slotIndex) => {
    if (!isEditing) return;
    e.dataTransfer.setData('source', 'slot');
    e.dataTransfer.setData('slotIndex', slotIndex.toString());
    e.dataTransfer.effectAllowed = 'move';

    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (isEditing) setDragOverSlot(index);
  };

  const handleDragLeave = () => setDragOverSlot(null);

  const handleDrop = async (e, targetSlot) => {
    e.preventDefault();
    setDragOverSlot(null);
    if (!user || !isEditing) return;

    const source = e.dataTransfer.getData('source');
    const targetKey = `${currentPage}-${targetSlot}`;
    const updates = {};

    if (source === 'collection') {
      const merchId = e.dataTransfer.getData('merchId');
      updates[`slots.${targetKey}`] = merchId;
    } else if (source === 'slot') {
      const sourceSlot = parseInt(e.dataTransfer.getData('slotIndex'), 10);
      if (sourceSlot === targetSlot) return;

      const sourceKey = `${currentPage}-${sourceSlot}`;
      const sourceMerchId = activeBinder.slots?.[sourceKey];
      const targetMerchId = activeBinder.slots?.[targetKey];

      updates[`slots.${sourceKey}`] = targetMerchId ? targetMerchId : deleteField();
      updates[`slots.${targetKey}`] = sourceMerchId ? sourceMerchId : deleteField();
    }

    await onUpdate(updates);
  };

  return {
    dragOverSlot,
    handleCollectionDragStart,
    handleSlotDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}