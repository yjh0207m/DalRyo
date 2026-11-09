import React from 'react';
import { Image, View as MockView } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { TogetherScreen } from '../src/screens/together/TogetherScreen';
import type { CharacterDocument } from '../src/types/character.types';
import type { UserDocument } from '../src/types/user.types';
import type { RoomFriend, RoomInvite } from '../src/services/room.service';
let mockPeer = false;
let mockRoomState = 'running';
let mockRoomId: string | null = 'room-one';
const mockRequest = jest.fn(
  async (
    ..._args: unknown[]
  ): Promise<{ friends: RoomFriend[]; invites: RoomInvite[] }> => ({
    friends: [],
    invites: [],
  }),
);
const mockSaved = {
  run_id: 'saved-group-run',
  distance_km: 2,
  avg_speed_kmh: 12,
  duration_sec: 600,
  avg_pace_sec: 300,
  calories: 120,
  route: [],
};
const mockSave = jest.fn(async (..._args: unknown[]) => mockSaved),
  mockRunning = jest.fn(),
  mockCompleted = jest.fn();
jest.mock('../src/services/room.service', () => ({
  newRoomId: () => 'unused',
  activeRoomId: async () => mockRoomId,
  roomRequest: (...args: unknown[]) => mockRequest(...args),
  publishRoomProgress: jest.fn(),
  watchRoom: (
    _id: string,
    next: (r: unknown) => void,
    members: (r: unknown) => void,
  ) => {
    next({
      room_id: 'room-one',
      title: 'Friend run',
      status: mockRoomState,
      host_uid: 'me',
      goal_km: 5,
      member_count: mockPeer ? 2 : 1,
      capacity: 2,
    });
    members([
      {
        uid: 'me',
        display_name: 'Me',
        current_km: 0,
        pace_sec: 0,
        state: 'active',
      },
      ...(mockPeer
        ? [
            {
              uid: 'friend',
              display_name: '민수',
              profile_image: 'https://example.test/member.jpg',
              current_km: 3.2,
              pace_sec: 420,
              state: 'active',
            },
          ]
        : []),
    ]);
    return () => {};
  },
}));
jest.mock('../src/services/social.service', () => ({
  myUid: () => 'me',
  socialError: (e: Error) => e.message,
  socialRequest: async () => ({
    profile: {
      display_name: '민수',
      profile_image: 'https://example.test/latest.jpg',
    },
    pet: { character_type: 'duck', stage: 'child', pet_name: '오리' },
  }),
}));
jest.mock('../src/hooks/usePostAuthor', () => ({
  usePostAuthor: () => undefined,
}));
jest.mock('../src/components/character/CharacterView', () => ({
  CharacterView: (props: object) => <MockView testID="track-pet" {...props} />,
}));
jest.mock('../src/services/runOutbox.service', () => ({
  queueRun: async () => 'pending',
  uploadPendingRun: (...args: unknown[]) => mockSave(...args),
}));
jest.mock('../src/screens/run/RunningScreen', () => ({
  RunningScreen: (props: unknown) => {
    mockRunning(props);
    return <MockView />;
  },
}));
jest.mock('../src/screens/run/CompletedRunScreen', () => ({
  CompletedRunScreen: (props: unknown) => {
    mockCompleted(props);
    return <MockView />;
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: MockView }));
jest.mock('lucide-react-native', () => ({
  Check: () => null,
  ChevronLeft: () => null,
  Flag: () => null,
  Footprints: () => null,
  Search: () => null,
  UserPlus: () => null,
  UserRound: () => null,
  Users: () => null,
}));
test('a group completion keeps the start snapshot even after live profile updates', async () => {
  const user = {
    uid: 'me',
    total_km: 49,
    is_frozen: true,
    weight_kg: 60,
  } as UserDocument;
  const character = {
    stage: 'baby',
    character_type: 'rabbit',
    pet_name: '달료',
  } as CharacterDocument;
  let tree: Renderer.ReactTestRenderer;
  await act(async () => {
    tree = Renderer.create(
      <TogetherScreen user={user} character={character} onBack={jest.fn()} />,
    );
  });
  try {
    await act(() =>
      tree.root.findByProps({ label: '달리기 참여' }).props.onPress(),
    );
    await act(() =>
      tree.update(
        <TogetherScreen
          user={{ ...user, total_km: 51, is_frozen: false }}
          character={{ ...character, stage: 'child' }}
          onBack={jest.fn()}
        />,
      ),
    );
    await act(async () => {
      await mockRunning.mock.calls
        .at(-1)![0]
        .onFinish({
          startedAt: new Date(),
          distanceKm: 2,
          durationSec: 600,
          avgSpeedKmh: 12,
          calories: 120,
          route: [],
        });
    });
    expect(mockCompleted.mock.calls.at(-1)![0]).toMatchObject({
      run: mockSaved,
      before: { stageBefore: 'baby', totalKmBefore: 49, wasFrozen: true },
    });
  } finally {
    await act(() => tree!.unmount());
  }
});

test('on reaching the goal, the finished runner can keep watching the actual peer pet', async () => {
  mockPeer = true;
  const user = { uid: 'me', total_km: 0, weight_kg: 60 } as UserDocument;
  const character = {
    stage: 'baby',
    character_type: 'rabbit',
  } as CharacterDocument;
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => {
    tree = Renderer.create(
      <TogetherScreen user={user} character={character} onBack={jest.fn()} />,
    );
  });
  try {
    await act(() =>
      tree.root.findByProps({ label: '달리기 참여' }).props.onPress(),
    );
    const active = mockRunning.mock.calls.at(-1)![0];
    expect(active.finishAtGoal).toBe(true);
    await act(async () =>
      active.onFinish({
        startedAt: new Date(),
        distanceKm: 5,
        durationSec: 1800,
        avgSpeedKmh: 10,
        calories: 300,
        route: [],
      }),
    );
    expect(JSON.stringify(tree.toJSON())).toContain(
      '친구의 달리기를 보고 있어요',
    );
    expect(
      tree.root
        .findAllByProps({ testID: 'track-pet' })
        .some(
          node =>
            node.props.type === 'duck' &&
            node.props.stage === 'child' &&
            node.props.motion === 'run',
        ),
    ).toBe(true);
    expect(
      tree.root.findAllByType(Image).map(node => node.props.source.uri),
    ).toContain('https://example.test/latest.jpg');
    await act(() =>
      tree.root.findByProps({ label: '내 기록 보기' }).props.onPress(),
    );
    expect(mockCompleted.mock.calls.at(-1)![0]).toMatchObject({
      run: mockSaved,
    });
  } finally {
    mockPeer = false;
    await act(() => tree!.unmount());
  }
});

test('the lobby renders the host and participant photos already present on the room', async () => {
  mockRoomState = 'waiting';
  mockPeer = true;
  const user = {
    uid: 'me',
    display_name: '내 프로필',
    profile_image: 'https://example.test/me.jpg',
  } as UserDocument;
  const character = {
    stage: 'baby',
    character_type: 'rabbit',
  } as CharacterDocument;
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => {
    tree = Renderer.create(
      <TogetherScreen user={user} character={character} onBack={jest.fn()} />,
    );
  });
  try {
    expect(
      tree.root.findAllByType(Image).map(node => node.props.source.uri),
    ).toEqual([
      'https://example.test/me.jpg',
      'https://example.test/member.jpg',
    ]);
    expect(tree.root.findByProps({ label: '함께 달리기 시작' })).toBeDefined();
  } finally {
    mockRoomState = 'running';
    mockPeer = false;
    await act(() => tree.unmount());
  }
});

test('the friend picker shows profile photos and keeps selections when searching', async () => {
  mockRoomId = null;
  const friends = [
    {
      uid: 'a',
      display_name: '유진',
      profile_image: 'https://example.test/a.jpg',
    },
    {
      uid: 'b',
      display_name: '민수',
      profile_image: 'https://example.test/b.jpg',
    },
  ];
  mockRequest.mockResolvedValue({ friends, invites: [] });
  const user = { uid: 'me' } as UserDocument;
  const character = {
    stage: 'baby',
    character_type: 'rabbit',
  } as CharacterDocument;
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => {
    tree = Renderer.create(
      <TogetherScreen user={user} character={character} onBack={jest.fn()} />,
    );
  });
  try {
    expect(
      tree.root.findAllByType(Image).map(node => node.props.source.uri),
    ).toEqual(friends.map(friend => friend.profile_image));
    const select = (name: string) =>
      tree.root
        .findAllByProps({
          accessibilityLabel: name,
          accessibilityRole: 'checkbox',
        })
        .find(node => node.props.onPress)!
        .props.onPress();
    await act(() => select('유진'));
    const search = tree.root
      .findAllByProps({ accessibilityLabel: '친구 닉네임 검색' })
      .find(node => node.props.onChangeText)!;
    await act(() => search.props.onChangeText('민수'));
    expect(
      tree.root.findAllByType(Image).map(node => node.props.source.uri),
    ).toEqual(['https://example.test/b.jpg']);
    await act(() => select('민수'));
    expect(
      tree.root.findByProps({ label: '2명에게 요청 보내기' }).props.disabled,
    ).toBe(false);
  } finally {
    mockRoomId = 'room-one';
    mockRequest.mockResolvedValue({ friends: [], invites: [] });
    await act(() => tree.unmount());
  }
});
