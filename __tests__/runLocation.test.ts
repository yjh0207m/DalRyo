import type { RunDocument } from '../src/types/run.types';
import {
  districtLabel,
  fetchRunDistrict,
} from '../src/services/runLocation.service';

const kr = { country_code: 'kr' };
const route = [{ lat: 37.5665, lng: 126.978, timestamp: 1 }];
const runWith = (points: RunDocument['route']) =>
  ({ route: points } as RunDocument);
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('districtLabel', () => {
  test('stops at the 구·군 level: 시·도, 시·군, then 구', () => {
    expect(
      districtLabel({
        ...kr,
        city: '서울특별시',
        borough: '강남구',
        suburb: '역삼동',
      }),
    ).toBe('서울특별시 강남구');
    expect(
      districtLabel({
        ...kr,
        state: '경기도',
        city: '수원시',
        borough: '영통구',
        suburb: '영통동',
      }),
    ).toBe('경기도 수원시 영통구');
    expect(
      districtLabel({ ...kr, state: '제주특별자치도', city: '제주시' }),
    ).toBe('제주특별자치도 제주시');
    expect(
      districtLabel({
        ...kr,
        state: '강원특별자치도',
        county: '평창군',
        village: '대관령면',
      }),
    ).toBe('강원특별자치도 평창군');
  });

  test('does not repeat a name that appears at two levels', () => {
    expect(
      districtLabel({
        ...kr,
        state: '서울특별시',
        city: '서울특별시',
        city_district: '마포구',
      }),
    ).toBe('서울특별시 마포구');
  });

  test('is null outside Korea or when there is nothing usable', () => {
    expect(districtLabel({ country_code: 'jp', state: '東京都' })).toBeNull();
    expect(districtLabel({ ...kr, suburb: '역삼동' })).toBeNull();
    expect(districtLabel(null)).toBeNull();
    expect(districtLabel('서울')).toBeNull();
  });
});

describe('fetchRunDistrict', () => {
  test('asks for the district of the start point using coordinates rounded to about 1km', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          address: { ...kr, city: '서울특별시', borough: '중구' },
        }),
      });
    globalThis.fetch = fetchMock;
    await expect(fetchRunDistrict(runWith(route))).resolves.toBe(
      '서울특별시 중구',
    );
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('lat=37.57');
    expect(url).toContain('lon=126.98');
    expect(url).not.toContain('37.5665');
    expect(url).toContain('zoom=12');
    expect(url).toContain('accept-language=ko');
  });

  test('without a recorded route nothing is sent', async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    await expect(fetchRunDistrict(runWith([]))).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a failed or unusable response gives null instead of an error', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchRunDistrict(runWith(route))).resolves.toBeNull();
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false });
    await expect(fetchRunDistrict(runWith(route))).resolves.toBeNull();
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'Unable to geocode' }),
      });
    await expect(fetchRunDistrict(runWith(route))).resolves.toBeNull();
  });
});
