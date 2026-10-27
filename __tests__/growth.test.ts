import {calculateRunExp, getCharacterStage, getDaysSinceRun, getNextStageProgress, getStoneLevel} from '../src/utils/exp';
import {getMotion} from '../src/utils/motion';
import {calcDistanceKm, estimateCalories} from '../src/utils/distance';
import {formatClock} from '../src/utils/pace';
import * as server from '../functions/src/growth';

describe('성장 단계', () => {
  test.each([
    [0, 'egg'],
    [0.01, 'baby'],
    [49.9, 'baby'],
    [50, 'child'],
    [199.9, 'child'],
    [200, 'runner'],
    [1000, 'runner'],
  ])('%skm → %s', (km, stage) => {
    expect(getCharacterStage(km)).toBe(stage);
  });

  test('앱과 서버(functions)의 성장 규칙이 같다', () => {
    for (const km of [0, 0.3, 5, 50, 120, 200, 999]) {
      expect(server.getCharacterStage(km)).toBe(getCharacterStage(km));
      expect(server.calculateRunExp(km)).toBe(calculateRunExp(km));
    }
  });

  test('단계는 되돌아가지 않는다', () => {
    expect(server.laterStage('child', 'baby')).toBe('child');
    expect(server.laterStage('baby', 'runner')).toBe('runner');
  });

  test('스탯은 100을 넘지 않는다', () => {
    expect(server.addStat(98, 5)).toBe(100);
    expect(server.addStat(undefined, 3)).toBe(3);
  });
});

describe('다음 단계 진행률', () => {
  test('아기 25km → 어린이까지 25km, 50%', () => {
    expect(getNextStageProgress('baby', 25)).toEqual({next: 'child', remainingKm: 25, progress: 0.5});
  });

  test('어린이 125km → 러너까지 75km, 50%', () => {
    expect(getNextStageProgress('child', 125)).toEqual({next: 'runner', remainingKm: 75, progress: 0.5});
  });

  test('알과 러너는 진행률 없음', () => {
    expect(getNextStageProgress('egg', 0)).toBeNull();
    expect(getNextStageProgress('runner', 300)).toBeNull();
  });
});

describe('돌 변신', () => {
  const DAY = 86_400_000;
  const now = Date.UTC(2026, 9, 26);

  test.each([
    [null, 'none'],
    [0, 'none'],
    [2, 'none'],
    [3, 'warn3'],
    [4, 'warn3'],
    [5, 'warn5'],
    [6, 'warn5'],
    [7, 'stone'],
    [30, 'stone'],
  ])('%s일 → %s', (days, level) => {
    expect(getStoneLevel(days as number | null)).toBe(level);
  });

  test('경과 일수는 내림', () => {
    expect(getDaysSinceRun(now - 3 * DAY + 1000, now)).toBe(2);
    expect(getDaysSinceRun(now - 3 * DAY, now)).toBe(3);
    expect(getDaysSinceRun(null, now)).toBeNull();
  });

  test('앱과 서버의 돌 변신 규칙이 같다', () => {
    for (const days of [null, 0, 3, 4, 5, 6, 7, 10]) {
      expect(server.getStoneLevel(days)).toBe(getStoneLevel(days));
    }
  });

  test('경고 알림은 3일·5일째에만, 7일 이상은 돌', () => {
    expect([2, 3, 4, 5, 6, 7, 9].map(server.getStoneNotice)).toEqual([null, 'warn3', null, 'warn5', null, 'stone', 'stone']);
  });
});

describe('속도 연동 모션', () => {
  test.each([
    [0, 'rest'],
    [4, 'slow'],
    [8, 'run'],
    [12, 'sprint'],
  ])('%skm/h → %s', (kmh, motion) => {
    expect(getMotion(kmh)).toBe(motion);
  });

  test('돌 변신이면 속도와 관계없이 stone', () => {
    expect(getMotion(12, true)).toBe('stone');
  });
});

describe('거리·칼로리·시간', () => {
  test('서울시청 → 광화문 약 1.05km', () => {
    expect(calcDistanceKm(37.5665, 126.978, 37.5759, 126.9768)).toBeCloseTo(1.05, 1);
  });

  test('체중이 없으면 60kg 기준', () => {
    expect(estimateCalories(5, null)).toBe(311);
    expect(estimateCalories(5, 70)).toBe(363);
  });

  test('HH:MM:SS 형식', () => {
    expect(formatClock(383)).toBe('00:06:23');
    expect(formatClock(3725)).toBe('01:02:05');
  });
});
