import {documentId, scopedImageUrl, validateAccount} from '../functions/src/validation';

const input = {displayName: '달리너', petName: '달료', website: '', heightCm: null, weightKg: 60, gender: null, region: '경기', dialect: 'std', notifications: {push: false, growth: true, social: true, stone: true}};
test('account validation excludes server-owned growth and follower fields', () => {
  const changes = validateAccount({...input, total_km: 999999, following_count: 99});
  expect(changes.pet_name).toBe('달료');
  expect(changes).not.toHaveProperty('total_km');
  expect(changes).not.toHaveProperty('following_count');
});
test('invalid names, numeric coercion and missing notification preferences are rejected', () => {
  expect(() => validateAccount({...input, petName: ' '.repeat(4)})).toThrow();
  expect(() => validateAccount({...input, weightKg: '60'})).toThrow();
  expect(() => validateAccount({...input, notifications: {push: true}})).toThrow();
});
test('uploaded profile URLs must point to the signed-in users profile folder', () => {
  const url = 'https://firebasestorage.googleapis.com/v0/b/dalryo-dev.firebasestorage.app/o/profiles%2Fmy-uid%2Fphoto.jpg?alt=media';
  expect(scopedImageUrl(url, 'my-uid', 'profiles')).toBe(url);
  expect(() => scopedImageUrl(url, 'other-uid', 'profiles')).toThrow();
  expect(() => scopedImageUrl(url, 'my-uid', 'posts')).toThrow();
  expect(() => scopedImageUrl('https://example.com/photo.jpg', 'my-uid', 'profiles')).toThrow();
});
test('document ids cannot escape the intended collection', () => {
  expect(documentId('id-123')).toBe('id-123');
  expect(() => documentId('../users/another')).toThrow();
});
