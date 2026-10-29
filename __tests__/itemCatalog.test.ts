import {cleanEquipped, findItem, ITEM_CATALOG} from '../functions/src/itemCatalog';
test('only catalogue items in their registered slot can be displayed', () => {
  expect(cleanEquipped({back:'gold-stars',accessory:'mint-glow',top:'untrusted-url'})).toEqual({});
  expect(cleanEquipped({back:'peach-glow',accessory:'pink-petals',unknown:'gold-stars'})).toEqual({back:'peach-glow',accessory:'pink-petals'});
  expect(cleanEquipped(null)).toEqual({});expect(cleanEquipped([])).toEqual({});
  expect(findItem('__proto__')).toBeUndefined();
});
test('catalogue identifiers are unique and rewards have a nonnegative distance', () => {
  expect(new Set(ITEM_CATALOG.map(item=>item.id)).size).toBe(ITEM_CATALOG.length);
  expect(ITEM_CATALOG.every(item=>item.unlockKm>=0)).toBe(true);
});
