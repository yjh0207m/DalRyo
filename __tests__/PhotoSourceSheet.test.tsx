import React from 'react';
import {Modal, Platform, Text} from 'react-native';
import Renderer, {act} from 'react-test-renderer';
import {PhotoSourceSheet} from '../src/components/ui/PhotoSourceSheet';

jest.mock('lucide-react-native', () => ({Camera: () => null, Image: () => null, Trash2: () => null}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

let tree: Renderer.ReactTestRenderer;
const handlers = {onClose: jest.fn(), onCamera: jest.fn(), onAlbum: jest.fn(), onRemove: jest.fn()};
async function render(props: Partial<React.ComponentProps<typeof PhotoSourceSheet>> = {}) {
  await act(async () => {
    tree = Renderer.create(
      <PhotoSourceSheet visible onClose={handlers.onClose} onCamera={handlers.onCamera} onAlbum={handlers.onAlbum} {...props} />,
    );
  });
}
const labels = () => tree.root.findAllByType(Text).map(node => node.props.children);
async function press(label: string) {
  let node: Renderer.ReactTestInstance | null = tree.root.findAllByType(Text).find(text => text.props.children === label) ?? null;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`no pressable for ${label}`);
  await act(async () => node!.props.onPress());
}
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('offers camera and album, and only offers deleting when a photo exists', async () => {
  await render();
  expect(labels()).toEqual(expect.arrayContaining(['사진 촬영', '앨범에서 선택', '취소']));
  expect(labels()).not.toContain('사진 삭제');
  await act(async () => tree.unmount());
  await render({onRemove: handlers.onRemove});
  expect(labels()).toContain('사진 삭제');
});

test('on iOS the picker opens only after the modal has finished dismissing, and only once', async () => {
  await render();
  await press('앨범에서 선택');
  expect(handlers.onClose).toHaveBeenCalledTimes(1);
  expect(handlers.onAlbum).not.toHaveBeenCalled();
  const modal = tree.root.findByType(Modal);
  await act(async () => modal.props.onDismiss());
  expect(handlers.onAlbum).toHaveBeenCalledTimes(1);
  await act(async () => modal.props.onDismiss());
  expect(handlers.onAlbum).toHaveBeenCalledTimes(1);
  expect(handlers.onCamera).not.toHaveBeenCalled();
});

test('on Android the picker opens right away', async () => {
  const original = Platform.OS;
  (Platform as {OS: string}).OS = 'android';
  try {
    await render({onRemove: handlers.onRemove});
    await press('사진 촬영');
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
    expect(handlers.onCamera).toHaveBeenCalledTimes(1);
    await press('사진 삭제');
    expect(handlers.onRemove).toHaveBeenCalledTimes(1);
  } finally {
    (Platform as {OS: string}).OS = original;
  }
});

test('cancel only closes the sheet', async () => {
  await render();
  await press('취소');
  expect(handlers.onClose).toHaveBeenCalledTimes(1);
  expect(handlers.onCamera).not.toHaveBeenCalled();
  expect(handlers.onAlbum).not.toHaveBeenCalled();
});

test('on iOS the choice still runs if the dismiss notice never arrives', async () => {
  jest.useFakeTimers();
  try {
    await render();
    await press('사진 촬영');
    expect(handlers.onCamera).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(handlers.onCamera).toHaveBeenCalledTimes(1);
    // 뒤늦게 닫힘 알림이 와도 두 번 실행되지 않는다
    const modal = tree.root.findByType(Modal);
    await act(async () => modal.props.onDismiss());
    expect(handlers.onCamera).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
