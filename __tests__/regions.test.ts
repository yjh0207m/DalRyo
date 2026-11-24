import {
  areaKind,
  isDetailedRegion,
  isRegion,
  REGION_AREAS,
  regionLabel,
  splitRegion,
} from '../src/utils/regions';
import { REGIONS } from '../src/utils/profile';
import { REGION_PATTERN, validateAccount } from '../functions/src/validation';
import { validateProfile, type ProfileForm } from '../src/utils/profile';

test('every province has its 시·군·구 list, in the same order as the profile region list', () => {
  expect(Object.keys(REGION_AREAS)).toEqual(REGIONS);
});

test('the lists match the administrative units: 구·군 for metropolitan cities, 시·군 for provinces', () => {
  const counts = Object.fromEntries(
    Object.entries(REGION_AREAS).map(([province, areas]) => [
      province,
      areas.length,
    ]),
  );
  expect(counts).toEqual({
    서울: 25,
    부산: 16,
    대구: 9,
    인천: 11,
    광주: 5,
    대전: 5,
    울산: 5,
    세종: 0,
    경기: 31,
    강원: 18,
    충북: 11,
    충남: 15,
    전북: 14,
    전남: 22,
    경북: 22,
    경남: 18,
    제주: 2,
  });
  for (const [province, areas] of Object.entries(REGION_AREAS)) {
    expect(new Set(areas).size).toBe(areas.length);
    const ending = areaKind(province) === '구·군' ? /[구군]$/ : /[시군]$/;
    for (const area of areas) expect(area).toMatch(ending);
  }
});

test('the server and the security rules accept every region the app can save', () => {
  for (const [province, areas] of Object.entries(REGION_AREAS)) {
    expect(REGION_PATTERN.test(province)).toBe(true);
    for (const area of areas)
      expect(REGION_PATTERN.test(regionLabel(province, area))).toBe(true);
  }
  expect(REGION_PATTERN.test('경기도 수원시')).toBe(false);
  expect(REGION_PATTERN.test('경기 수원시 영통구')).toBe(false);
  expect(REGION_PATTERN.test('서울 <script>')).toBe(false);
});

test('a region is split, checked, and told apart from a too-broad province', () => {
  expect(splitRegion('경기 수원시')).toEqual({
    province: '경기',
    area: '수원시',
  });
  expect(splitRegion('경기')).toEqual({ province: '경기', area: null });
  expect(isRegion('경기 수원시')).toBe(true);
  // 예전에 시·도만 저장한 값도 그대로 받는다
  expect(isRegion('경기')).toBe(true);
  expect(isRegion('경기 강남구')).toBe(false);
  expect(isRegion('경기도')).toBe(false);
  expect(isDetailedRegion('서울 강남구')).toBe(true);
  expect(isDetailedRegion('세종')).toBe(true);
  expect(isDetailedRegion('경기')).toBe(false);
  expect(isDetailedRegion(null)).toBe(false);
});

test('the app and the server both save a detailed region and reject a made-up one', () => {
  const form: ProfileForm = {
    displayName: '달리너',
    website: '',
    height: '',
    weight: '',
    gender: null,
    region: '부산 해운대구',
    dialect: 'gyeong',
  };
  expect(validateProfile(form).region).toBe('부산 해운대구');
  expect(() => validateProfile({ ...form, region: '부산 수원시' })).toThrow(
    '지역',
  );
  const account = {
    displayName: '달리너',
    petName: '달료',
    website: '',
    heightCm: null,
    weightKg: null,
    gender: null,
    region: '부산 해운대구',
    dialect: 'gyeong',
    notifications: { push: false, growth: true, social: true, stone: true },
  };
  expect(validateAccount(account).region).toBe('부산 해운대구');
  expect(validateAccount({ ...account, region: '경기' }).region).toBe('경기');
  expect(() =>
    validateAccount({ ...account, region: '경기도 수원시' }),
  ).toThrow('지역');
});
