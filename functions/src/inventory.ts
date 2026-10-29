import {FieldValue, getFirestore} from 'firebase-admin/firestore';
import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {cleanEquipped, findItem, ITEM_CATALOG, ITEM_SLOTS, InventoryState, ItemSlot} from './itemCatalog';

// Firebase user tokens are verified by onCall; Cloud Run must let those
// requests reach the callable instead of requiring a service-account token.
export const inventoryAction = onCall({region: 'asia-northeast3', maxInstances: 5, invoker: 'public'}, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요해요.');
  const data = request.data ?? {};
  if (!['list', 'equip', 'unequip'].includes(data.action)) throw new HttpsError('invalid-argument', '요청을 확인해 주세요.');
  const item = data.action === 'equip' ? findItem(data.itemId) : undefined;
  if (data.action === 'equip' && !item) throw new HttpsError('invalid-argument', '등록되지 않은 아이템이에요.');
  if (data.action === 'unequip' && !ITEM_SLOTS.includes(data.slot)) throw new HttpsError('invalid-argument', '장착 위치를 확인해 주세요.');
  const db = getFirestore();
  const userRef = db.collection('users').doc(request.auth.uid);
  const characterRef = userRef.collection('character').doc(request.auth.uid);
  return db.runTransaction(async tx => {
    const [user, character, inventory] = await Promise.all([
      tx.get(userRef), tx.get(characterRef), tx.get(userRef.collection('inventory')),
    ]);
    if (!user.exists || !character.exists) throw new HttpsError('failed-precondition', '프로필을 먼저 완료해 주세요.');
    const storedKm = user.get('total_km');
    const totalKm = typeof storedKm === 'number' && Number.isFinite(storedKm) ? Math.max(0, storedKm) : 0;
    const owned = new Set(inventory.docs.filter(doc => findItem(doc.id)).map(doc => doc.id));
    // Eligibility is calculated solely from server-owned mileage. Create once;
    // a retried request never duplicates rewards or rewrites acquisition dates.
    for (const reward of ITEM_CATALOG) {
      if (totalKm >= reward.unlockKm && !owned.has(reward.id)) {
        tx.create(userRef.collection('inventory').doc(reward.id), {
          item_id: reward.id, source: reward.unlockKm === 0 ? 'starter' : 'distance', acquired_at: FieldValue.serverTimestamp(),
        });
        owned.add(reward.id);
      }
    }
    const equipped = cleanEquipped(character.get('equipped'));
    for (const slot of ITEM_SLOTS) if (equipped[slot] && !owned.has(equipped[slot]!)) delete equipped[slot];
    if (data.action === 'equip') {
      if (!owned.has(item!.id)) throw new HttpsError('permission-denied', '아직 보유하지 않은 아이템이에요.');
      equipped[item!.slot] = item!.id;
    } else if (data.action === 'unequip') delete equipped[data.slot as ItemSlot];
    if (data.action !== 'list' || JSON.stringify(equipped) !== JSON.stringify(character.get('equipped') ?? {})) {
      tx.update(characterRef, {equipped, updated_at: FieldValue.serverTimestamp()});
    }
    return {owned: [...owned], equipped, totalKm} satisfies InventoryState;
  });
});
