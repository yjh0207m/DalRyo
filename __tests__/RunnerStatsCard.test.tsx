import React from 'react';
import { StyleSheet, Text, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { RunnerStatsCard } from '../src/screens/community/RunnerStatsCard';
import type { RunnerProfile } from '../src/services/social.service';

jest.mock('../src/components/character/CharacterView', () => ({
  CharacterView: (props: object) => <MockView testID="pet" {...props} />,
}));
// 장면 그림(SVG)은 테스트에서 그릴 필요가 없다. 자식(캐릭터)만 그대로 보여 준다
jest.mock('../src/components/scene/CompanionScene', () => ({
  CompanionScene: ({
    children,
    height,
  }: {
    children: React.ReactNode;
    height: number;
  }) => (
    <MockView testID="scene" style={{ height }}>
      {children}
    </MockView>
  ),
}));
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);

const person = {
  uid: 'peer',
  display_name: '달리는 오리',
  profile_image: null,
  total_km: 1.6,
  region: '서울',
  follower_count: 0,
  following_count: 0,
  influencer_tier: 'none',
};
const run = (day: string, distance_km: number) => ({
  day,
  distance_km,
  duration_sec: 600,
  avg_pace_sec: 330,
});
const runner: RunnerProfile = {
  profile: person,
  following: false,
  pet: {
    character_type: 'duck',
    stage: 'baby',
    pet_name: '콩이',
    exp: 10,
    is_frozen: false,
    stat_stamina: 30,
    stat_speed: 20,
    stat_endurance: 10,
  },
  run_count: 6,
  recent_runs: [run('2026. 11. 2.', 3), run('2026. 11. 1.', 5)],
};

let tree: Renderer.ReactTestRenderer;
const onToggle = jest.fn();
const onOpen = jest.fn();
const draw = (
  props: Partial<React.ComponentProps<typeof RunnerStatsCard>> = {},
) => (
  <RunnerStatsCard
    runner={runner}
    runsOpen={false}
    onToggleRuns={onToggle}
    onOpenRuns={onOpen}
    {...props}
  />
);
async function render(
  props: Partial<React.ComponentProps<typeof RunnerStatsCard>> = {},
) {
  await act(async () => {
    tree = Renderer.create(draw(props));
  });
}
const texts = () =>
  tree.root.findAllByType(Text).map(node =>
    ([] as unknown[])
      .concat(node.props.children)
      .filter(part => typeof part === 'string' || typeof part === 'number')
      .join(''),
  );
const pressable = (label: string) =>
  tree.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label,
  )[0];
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree.unmount());
});

describe('the character side', () => {
  test('shows the character on the same meadow scene as the home screen, with the old lines gone', async () => {
    await render();
    const scene = tree.root.findByProps({ testID: 'scene' });
    expect(scene.findByProps({ testID: 'pet' }).props.type).toBe('duck');
    const all = texts();
    expect(all).toContain('콩이');
    expect(all).toContain('아기');
    expect(all).not.toContain('RUNNING MATE');
    expect(all).not.toContain('함께 달리며 자라고 있어요');
  });

  test('the character wears the items it has equipped, so it looks the same as on its own home screen', async () => {
    const equipped = { back: 'mint-glow', accessory: 'gold-stars' };
    await render({
      runner: { ...runner, pet: { ...runner.pet!, equipped } },
    });
    expect(tree.root.findByProps({ testID: 'pet' }).props.equipped).toEqual(
      equipped,
    );
  });

  test('the character is big and above the stats, which sit in the white part below', async () => {
    await render();
    const pet = tree.root.findByProps({ testID: 'pet' });
    expect(pet.props.size).toBeGreaterThanOrEqual(170);
    const order = tree.root
      .findAll(() => true)
      .filter(
        node =>
          node.props?.testID === 'pet' ||
          (typeof node.type === 'string' && node.props?.children === '체력'),
      );
    expect(order[0].props.testID).toBe('pet');
    expect(order.at(-1)!.props.children).toBe('체력');
  });

  test('the name and the level chip sit over the scene like on the home screen, with the grade under the name', async () => {
    await render();
    const all = texts();
    expect(all.indexOf('콩이') + 1).toBe(all.indexOf('아기'));
    // 홈 화면의 칩과 같은 "LV. 02"
    expect(all.some(text => text.replace(/\s/g, '') === 'LV.02')).toBe(true);
    const size = (value: string) =>
      StyleSheet.flatten(
        tree.root
          .findAllByType(Text)
          .find(node => String(node.props.children) === value)!.props.style,
      ).fontSize;
    // 이름은 크게, 등급·라벨은 작게
    expect(size('콩이')).toBeGreaterThan(size('아기'));
    expect(size('콩이')).toBeGreaterThan(size('체력'));
  });

  test('each stat is a small label over a big number, in three equal columns', async () => {
    await render();
    const size = (value: string) =>
      StyleSheet.flatten(
        tree.root
          .findAllByType(Text)
          .find(node => String(node.props.children) === value)!.props.style,
      ).fontSize;
    expect(size('30')).toBeGreaterThan(size('체력'));
    const row = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        StyleSheet.flatten(node.props.style)?.flexDirection === 'row' &&
        node.children.length === 3 &&
        node.findAll(inner => inner.props.children === '속도').length > 0,
    );
    const columns = row.at(-1)!.children as Renderer.ReactTestInstance[];
    for (const column of columns)
      expect(StyleSheet.flatten(column.props.style).flex).toBe(1);
  });

  test('shows the distance as experience on one line: where it is, and the goal', async () => {
    await render();
    const all = texts();
    expect(all).toContain('경험치');
    expect(all).toContain('1.6 / 50km');
    // 같은 내용을 두 번 쓰지 않는다
    expect(all).not.toContain('어린이까지 48.4km');
    expect(all).not.toContain('누적 거리');
  });

  test('the top grade has no goal to show, so it shows only the distance', async () => {
    await render({
      runner: {
        ...runner,
        profile: { ...person, total_km: 900 },
        pet: { ...runner.pet!, stage: 'runner' },
      },
    });
    expect(texts()).toContain('900.0km');
  });

  test('shows the three growth stats', async () => {
    await render();
    const all = texts();
    for (const label of ['체력', '속도', '지구력'])
      expect(all).toContain(label);
    for (const value of ['30', '20', '10']) expect(all).toContain(value);
  });

  test('stats not yet sent by the server show as zero instead of breaking', async () => {
    const pet = {
      character_type: 'duck' as const,
      stage: 'baby' as const,
      pet_name: '콩이',
      exp: 10,
      is_frozen: false,
    };
    await render({ runner: { ...runner, pet } });
    expect(texts().filter(text => text === '0')).toHaveLength(3);
  });

  test('an egg explains how to hatch, and the top grade says it is the top', async () => {
    const pet = { ...runner.pet! };
    await render({ runner: { ...runner, pet: { ...pet, stage: 'egg' } } });
    expect(texts()).toContain('첫 달리기를 하면 부화해요');
    await act(async () => {
      tree.update(
        draw({
          runner: {
            ...runner,
            profile: { ...person, total_km: 900 },
            pet: { ...pet, stage: 'runner' },
          },
        }),
      );
    });
    expect(texts()).toContain('가장 높은 단계예요');
  });

  test('a frozen character says so', async () => {
    const pet = { ...runner.pet!, is_frozen: true };
    await render({ runner: { ...runner, pet } });
    expect(texts()).toContain('아기 · 다음 달리기를 기다려요');
    // 돌로 변한 모습은 홈과 같이 LobbyCharacter가 처리한다
    expect(tree.root.findByProps({ testID: 'pet' }).props.motion).toBe('stone');
  });

  test('without a character the runs are still reachable', async () => {
    await render({ runner: { ...runner, pet: null } });
    expect(tree.root.findAllByProps({ testID: 'pet' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'scene' })).toHaveLength(0);
    expect(texts()).toContain('완료한 러닝');
    expect(pressable('최근 러닝 보기')).toBeDefined();
  });
});

describe('the runs', () => {
  test('the completed-runs line is one pressable row that opens the runs, with its count inside', async () => {
    await render();
    const row = pressable('최근 러닝 보기');
    const words = row.findAllByType(Text).map(node =>
      ([] as unknown[])
        .concat(node.props.children)
        .filter(part => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
    expect(words).toContain('완료한 러닝');
    expect(words).toContain('6회');
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
    expect(StyleSheet.flatten(row.props.style).position).toBeUndefined();
  });

  test('a runner who keeps the runs private shows a lock instead, and nothing can be opened', async () => {
    await render({
      runsOpen: true,
      runner: {
        ...runner,
        run_count: null,
        runs_hidden: true,
        recent_runs: [],
      },
    });
    expect(texts()).toContain('러닝 기록은 비공개예요');
    expect(texts()).not.toContain('완료한 러닝');
    expect(pressable('최근 러닝 보기')).toBeUndefined();
    expect(
      tree.root.findAllByProps({ testID: 'profile-runs-list' }),
    ).toHaveLength(0);
  });

  test('the count of completed runs is in the stats, and the daily list stays closed', async () => {
    await render();
    expect(texts()).toContain('완료한 러닝');
    expect(texts()).toContain('6회');
    expect(
      tree.root.findAllByProps({ testID: 'profile-runs-list' }),
    ).toHaveLength(0);
  });

  test('the footprint button asks to open and to close the bubble', async () => {
    await render();
    await act(async () => pressable('최근 러닝 보기').props.onPress());
    expect(onToggle).toHaveBeenLastCalledWith(true);
    await act(async () => {
      tree.update(draw({ runsOpen: true }));
    });
    await act(async () => pressable('최근 러닝 보기').props.onPress());
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  test('the bubble lists days and distances, scrolls, and leads to the full record', async () => {
    await render({ runsOpen: true });
    const all = texts();
    expect(all).toEqual(
      expect.arrayContaining([
        '2026. 11. 2.',
        '3.00km',
        '2026. 11. 1.',
        '5.00km',
      ]),
    );
    await act(async () => pressable('러닝 기록 자세히 보기').props.onPress());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('tapping elsewhere on the card closes the bubble', async () => {
    await render({ runsOpen: true });
    await act(async () => pressable('러닝 기록 말풍선 닫기').props.onPress());
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  test('with no runs the bubble says so and offers nothing to open', async () => {
    await render({
      runsOpen: true,
      runner: { ...runner, run_count: 0, recent_runs: [] },
    });
    expect(texts()).toContain('아직 완료한 러닝이 없어요.');
    expect(pressable('러닝 기록 자세히 보기')).toBeUndefined();
  });
});
