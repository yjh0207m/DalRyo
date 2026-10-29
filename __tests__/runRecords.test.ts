import {buildCalendarCells, projectRunRoute, summarizeRunPeriod} from '../src/utils/runRecords';
import type {GpsPoint, RunDocument} from '../src/types/run.types';

describe('기록 화면 데이터', () => {
  test('페이스는 총 시간 / 총 거리로 계산한다', () => {
    const runs = [
      {distance_km: 1, duration_sec: 300, calories: 60},
      {distance_km: 9, duration_sec: 3600, calories: 540},
    ] as RunDocument[];
    expect(summarizeRunPeriod(runs)).toEqual({distanceKm: 10, durationSec: 3900, calories: 600, paceSec: 390});
  });

  test('기록이 없거나 거리가 0이면 페이스 계산을 건너뛴다', () => {
    expect(summarizeRunPeriod([]).paceSec).toBe(0);
    expect(summarizeRunPeriod([{distance_km: 0, duration_sec: 30, calories: 0}] as RunDocument[]).paceSec).toBe(0);
  });

  test('윤년 2월과 일요일 시작 월을 정렬한다', () => {
    const leap = buildCalendarCells(2024, 1);
    expect(leap.slice(0, 5)).toEqual([null, null, null, null, 1]);
    expect(leap[leap.length - 1]).toBe(29);
    expect(buildCalendarCells(2026, 10)[0]).toBe(1);
  });
});

describe('실제 GPS 경로 미리보기', () => {
  const point = (lat: number, lng: number): GpsPoint => ({lat, lng, timestamp: 0});

  test('빈 경로, 단일 좌표와 제자리 좌표는 경로를 만들지 않는다', () => {
    expect(projectRunRoute()).toEqual([]);
    expect(projectRunRoute([point(37, 127)])).toEqual([]);
    expect(projectRunRoute([point(37, 127), point(37, 127)])).toEqual([]);
  });

  test('북쪽은 위로, 동쪽은 오른쪽으로 그리고 여백을 유지한다', () => {
    const projected = projectRunRoute([point(37, 127), point(37.01, 127.01)]);
    expect(projected[1].x).toBeGreaterThan(projected[0].x);
    expect(projected[1].y).toBeLessThan(projected[0].y);
    projected.forEach(p => {
      expect(p.x).toBeGreaterThanOrEqual(20 - 1e-8);
      expect(p.x).toBeLessThanOrEqual(280 + 1e-8);
      expect(p.y).toBeGreaterThanOrEqual(20 - 1e-8);
      expect(p.y).toBeLessThanOrEqual(140 + 1e-8);
    });
  });

  test('수직·수평 경로에서도 NaN 없이 중앙에 정렬한다', () => {
    expect(projectRunRoute([point(37, 127), point(38, 127)]).map(p => p.x)).toEqual([150, 150]);
    expect(projectRunRoute([point(37, 127), point(37, 128)]).map(p => p.y)).toEqual([80, 80]);
  });

  test('잘못된 GPS 좌표를 제외한다', () => {
    const projected = projectRunRoute([point(NaN, 0), point(200, 0), point(37, 127), point(37.01, 127.01)]);
    expect(projected).toHaveLength(2);
  });
});
