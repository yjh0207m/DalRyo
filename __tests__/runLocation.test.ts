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
  test('a metropolitan city goes down to the 구·군, a province only to the 시·군', () => {
    expect(
      districtLabel({
        ...kr,
        city: '서울특별시',
        borough: '강남구',
        suburb: '역삼동',
      }),
    ).toBe('서울 강남구');
    // 도 아래 시의 구(영통구)까지는 쓰지 않는다
    expect(
      districtLabel({
        ...kr,
        state: '경기도',
        city: '수원시',
        borough: '영통구',
        suburb: '영통동',
      }),
    ).toBe('경기 수원시');
    expect(
      districtLabel({ ...kr, state: '제주특별자치도', city: '제주시' }),
    ).toBe('제주 제주시');
    expect(
      districtLabel({
        ...kr,
        state: '강원특별자치도',
        county: '평창군',
        village: '대관령면',
      }),
    ).toBe('강원 평창군');
    expect(districtLabel({ ...kr, city: '부산광역시', county: '기장군' })).toBe(
      '부산 기장군',
    );
  });

  test('세종 has nothing below it', () => {
    expect(
      districtLabel({ ...kr, city: '세종특별자치시', suburb: '보람동' }),
    ).toBe('세종');
  });

  test('경기도 광주시 is not mistaken for 광주광역시', () => {
    expect(districtLabel({ ...kr, state: '경기도', city: '광주시' })).toBe(
      '경기 광주시',
    );
    expect(districtLabel({ ...kr, city: '광주광역시', borough: '북구' })).toBe(
      '광주 북구',
    );
  });

  test('places the map still lists under their old city or province use the new one', () => {
    expect(districtLabel({ ...kr, state: '경상북도', county: '군위군' })).toBe(
      '대구 군위군',
    );
    expect(districtLabel({ ...kr, city: '인천광역시', borough: '동구' })).toBe(
      '인천 제물포구',
    );
  });

  test('does not repeat a name that appears at two levels', () => {
    expect(
      districtLabel({
        ...kr,
        state: '서울특별시',
        city: '서울특별시',
        city_district: '마포구',
      }),
    ).toBe('서울 마포구');
  });

  test('is null outside Korea, with nothing usable, or with only the province (too broad)', () => {
    expect(districtLabel({ country_code: 'jp', state: '東京都' })).toBeNull();
    expect(districtLabel({ ...kr, suburb: '역삼동' })).toBeNull();
    expect(districtLabel({ ...kr, state: '경기도' })).toBeNull();
    expect(districtLabel(null)).toBeNull();
    expect(districtLabel('서울')).toBeNull();
  });
});

describe('fetchRunDistrict', () => {
  test('asks for the district of the start point using coordinates rounded to about 1km', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        address: { ...kr, city: '서울특별시', borough: '중구' },
      }),
    });
    globalThis.fetch = fetchMock;
    await expect(fetchRunDistrict(runWith(route))).resolves.toBe('서울 중구');
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
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'Unable to geocode' }),
    });
    await expect(fetchRunDistrict(runWith(route))).resolves.toBeNull();
  });
});
