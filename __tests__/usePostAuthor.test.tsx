import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { usePostAuthor } from '../src/hooks/usePostAuthor';
const mockRequest = jest.fn(),
  mockStop = jest.fn(),
  mockSnapshot = jest.fn();
jest.mock('../src/services/social.service', () => ({
  myUid: () => 'me',
  socialRequest: (...args: unknown[]) => mockRequest(...args),
}));
jest.mock('../src/lib/firebase', () => ({
  firestore: () => ({
    collection: () => ({
      doc: () => ({
        onSnapshot: (...args: unknown[]) => mockSnapshot(...args),
      }),
    }),
  }),
}));
function Probe({ uid, token }: { uid: string; token?: number }) {
  const author = usePostAuthor(uid, token);
  return (
    <>
      {author?.display_name}:{author?.profile_image ?? 'none'}
    </>
  );
}
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRequest.mockResolvedValue({
    users: [{ uid: 'peer', display_name: '오리', profile_image: 'new.jpg' }],
  });
  mockSnapshot.mockReturnValue(mockStop);
});
afterEach(async () => {
  await act(() => tree?.unmount());
  jest.useRealTimers();
});
test('multiple posts share a batched public lookup and refresh new feed objects', async () => {
  await act(() => {
    tree = Renderer.create(
      <>
        <Probe uid="peer" />
        <Probe uid="peer" />
        <Probe uid="other" />
      </>,
    );
  });
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(mockRequest).toHaveBeenCalledWith('publicProfiles', {
    uids: ['peer', 'other'],
  });
  expect(JSON.stringify(tree.toJSON())).toContain('new.jpg');
  mockRequest.mockResolvedValue({
    users: [{ uid: 'peer', display_name: '오리', profile_image: 'newer.jpg' }],
  });
  await act(() => tree.update(<Probe uid="peer" token={1} />));
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  expect(JSON.stringify(tree.toJSON())).toContain('newer.jpg');
});
test('own photo changes update all old posts through one shared owner-only listener', async () => {
  await act(() => {
    tree = Renderer.create(
      <>
        <Probe key="a" uid="me" />
        <Probe key="b" uid="me" />
      </>,
    );
  });
  expect(mockSnapshot).toHaveBeenCalledTimes(1);
  await act(() =>
    mockSnapshot.mock.calls[0][0]({
      data: () => ({ display_name: '나', profile_image: 'mine.jpg' }),
    }),
  );
  expect(JSON.stringify(tree.toJSON()).match(/mine.jpg/g)).toHaveLength(2);
  await act(() =>
    tree.update(
      <>
        <Probe key="b" uid="me" />
      </>,
    ),
  );
  expect(mockStop).not.toHaveBeenCalled();
  await act(() =>
    mockSnapshot.mock.calls[0][0]({
      data: () => ({ display_name: '나', profile_image: null }),
    }),
  );
  expect(JSON.stringify(tree.toJSON())).not.toContain('mine.jpg');
  expect(mockRequest).not.toHaveBeenCalled();
});
test('a late response from a removed feed cannot overwrite the new photo', async () => {
  let resolveOld!: (value: unknown) => void;
  mockRequest.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveOld = resolve;
      }),
  );
  await act(() => {
    tree = Renderer.create(<Probe uid="peer" token={0} />);
  });
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  await act(() => tree.update(<Probe uid="peer" token={1} />));
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  await act(async () =>
    resolveOld({
      users: [{ uid: 'peer', display_name: 'old', profile_image: 'old.jpg' }],
    }),
  );
  expect(JSON.stringify(tree.toJSON())).toContain('new.jpg');
  expect(JSON.stringify(tree.toJSON())).not.toContain('old.jpg');
});
