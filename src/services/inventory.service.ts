import {getApp} from '@react-native-firebase/app';
import {getFunctions, httpsCallable} from '@react-native-firebase/functions';
import {auth} from '../lib/firebase';
import type {InventoryState, ItemSlot} from '../../functions/src/itemCatalog';

export async function inventoryRequest(action: 'list' | 'equip' | 'unequip', input: {itemId?: string; slot?: ItemSlot} = {}) {
  if (!auth().currentUser) throw new Error('로그인이 필요해요.');
  return (await httpsCallable<Record<string, unknown>, InventoryState>(
    getFunctions(getApp(), 'asia-northeast3'), 'inventoryAction',
  )({action, ...input})).data;
}
