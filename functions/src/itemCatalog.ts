// Shared by the callable and native app. New body-fitting clothes require vetted
// assets for each animal/stage; these decorations work with every silhouette.
export const ITEM_SLOTS = ['back', 'bottom', 'top', 'shoes', 'hat', 'accessory'] as const;
export type ItemSlot = typeof ITEM_SLOTS[number];
export type ItemDefinition = {
  id: string;
  name: string;
  description: string;
  slot: ItemSlot;
  unlockKm: number;
  visual: 'glow' | 'stars' | 'petals';
  color: string;
};
export const ITEM_CATALOG: readonly ItemDefinition[] = [
  {id: 'mint-glow', name: '새싹빛', description: '은은한 민트빛이 달리너를 감싸요.', slot: 'back', unlockKm: 0, visual: 'glow', color: '#8ADAC1'},
  {id: 'gold-stars', name: '응원별', description: '작은 별들이 곁에서 응원해요.', slot: 'accessory', unlockKm: 0, visual: 'stars', color: '#E8AC38'},
  {id: 'peach-glow', name: '노을빛', description: '누적 5km를 달리면 받는 따뜻한 빛이에요.', slot: 'back', unlockKm: 5, visual: 'glow', color: '#F5B29C'},
  {id: 'pink-petals', name: '꽃잎 응원', description: '누적 10km를 달리면 꽃잎이 함께해요.', slot: 'accessory', unlockKm: 10, visual: 'petals', color: '#DF93B3'},
];
export function findItem(id: unknown): ItemDefinition | undefined {
  return typeof id === 'string' ? ITEM_CATALOG.find(item => item.id === id) : undefined;
}
export function cleanEquipped(value: unknown): Partial<Record<ItemSlot, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Partial<Record<ItemSlot, string>> = {};
  for (const slot of ITEM_SLOTS) {
    const item = findItem((value as Record<string, unknown>)[slot]);
    if (item?.slot === slot) result[slot] = item.id;
  }
  return result;
}
export type InventoryState = {
  owned: string[];
  equipped: Partial<Record<ItemSlot, string>>;
  totalKm: number;
};
