import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { GrowthScreen } from '../src/screens/growth/GrowthScreen';
import type { CharacterDocument } from '../src/types/character.types';
import type { UserDocument } from '../src/types/user.types';

jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/navigation/BottomTabBar', () => ({ TAB_BAR_HEIGHT: 60 }));
jest.mock('../src/hooks/useRunRecords', () => ({
  useRunRecords: () => ({ runs: [], status: 'success', retry: jest.fn() }),
}));
jest.mock('../src/services/run.service', () => ({
  fetchRunsBetween: jest.fn(),
  getRunStartedAtDate: (run: { date: Date }) => run.date,
}));
jest.mock('../src/components/ui/ScreenHeader', () => {
  const { Text: MockText, View: MockBox } = require('react-native');
  return {
    ScreenHeader: ({ title }: { title: string }) => (
      <MockBox>
        <MockText>{title}</MockText>
      </MockBox>
    ),
  };
});

const user = {
  total_km: 12.5,
  total_exp: 100,
  last_run_at: null,
} as unknown as UserDocument;
const character = {
  character_type: 'rabbit',
  stage: 'baby',
  pet_name: '달료',
} as unknown as CharacterDocument;
let tree: Renderer.ReactTestRenderer;

afterEach(async () => {
  await act(async () => tree.unmount());
});

test('the growth screen has no tagline under the header', async () => {
  await act(async () => {
    tree = Renderer.create(
      <GrowthScreen
        user={user}
        character={character}
        onNotificationPress={jest.fn()}
        onSettingsPress={jest.fn()}
      />,
    );
  });
  const all = tree.root
    .findAllByType(Text)
    .map(node => ([] as unknown[]).concat(node.props.children).join(''));
  expect(all).toContain('성장');
  expect(all).toContain('누적 거리');
  expect(all.join('|')).not.toContain('달린 만큼');
});

test('the summary card sits close under the header now that the tagline is gone', async () => {
  await act(async () => {
    tree = Renderer.create(
      <GrowthScreen
        user={user}
        character={character}
        onNotificationPress={jest.fn()}
        onSettingsPress={jest.fn()}
      />,
    );
  });
  const summary = tree.root.findAllByProps({ testID: 'growth-summary' })[0];
  expect(StyleSheet.flatten(summary.props.style).marginTop).toBe(8);
});

test('the total distance stands alone as the largest number, with the last 7 days and EXP side by side below it', async () => {
  await act(async () => {
    tree = Renderer.create(
      <GrowthScreen
        user={user}
        character={character}
        onNotificationPress={jest.fn()}
        onSettingsPress={jest.fn()}
      />,
    );
  });
  const textsIn = (node: Renderer.ReactTestInstance) =>
    node
      .findAllByType(Text)
      .map(item => ([] as unknown[]).concat(item.props.children).join(''));
  const total = tree.root.findByProps({ testID: 'growth-total' });
  expect(textsIn(total)).toEqual(['누적 거리', '12.5', 'km']);
  const secondary = tree.root.findByProps({ testID: 'growth-secondary' });
  expect(StyleSheet.flatten(secondary.props.style).flexDirection).toBe('row');
  const labels = textsIn(secondary);
  expect(labels).toContain('최근 7일');
  expect(labels).toContain('EXP');
  // 누적 거리 숫자가 아래 줄 숫자보다 크다
  const fontSize = (node: Renderer.ReactTestInstance, value: string) =>
    StyleSheet.flatten(
      node
        .findAllByType(Text)
        .find(
          item =>
            ([] as unknown[]).concat(item.props.children).join('') === value,
        )!.props.style,
    ).fontSize;
  expect(fontSize(total, '12.5')).toBeGreaterThan(fontSize(secondary, '100'));
});

test('with no runs in the last 7 days the chart offers to start a run', async () => {
  const onStartRun = jest.fn();
  await act(async () => {
    tree = Renderer.create(
      <GrowthScreen
        user={user}
        character={character}
        onNotificationPress={jest.fn()}
        onSettingsPress={jest.fn()}
        onStartRun={onStartRun}
      />,
    );
  });
  const start = tree.root.find(
    node =>
      typeof node.type === 'function' &&
      node.type.name === 'Button' &&
      node.props.label === '달리기 시작',
  );
  await act(async () => start.props.onPress());
  expect(onStartRun).toHaveBeenCalledTimes(1);
});
