import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import {
  dismissBackgroundTask,
  resetBackgroundTasks,
  retryBackgroundTask,
  runInBackground,
  useBackgroundToasts,
  type BackgroundToast,
} from '../src/services/backgroundTask.service';

let seen: BackgroundToast[] = [];
function Probe() {
  seen = useBackgroundToasts();
  return null;
}
let tree: Renderer.ReactTestRenderer;
const flush = () => act(async () => {});
const base = {
  label: '게시물 올리는 중',
  failureLabel: '게시물을 올리지 못했어요',
};

beforeEach(async () => {
  jest.useFakeTimers();
  await act(async () => {
    tree = Renderer.create(<Probe />);
  });
});
afterEach(async () => {
  await act(async () => {
    resetBackgroundTasks();
    tree.unmount();
  });
  jest.useRealTimers();
});

test('shows progress while running, then a short done popup that disappears, and cleans up', async () => {
  let finish!: () => void;
  let report!: (percent: number) => void;
  const cleanup = jest.fn();
  const onSuccess = jest.fn();
  await act(async () => {
    runInBackground({
      ...base,
      successLabel: '게시물을 올렸어요',
      cleanup,
      onSuccess,
      task: progress => {
        report = progress;
        return new Promise<string>(resolve => {
          finish = () => resolve('ok');
        });
      },
    });
  });
  expect(seen).toMatchObject([
    { kind: 'running', message: '게시물 올리는 중', percent: null },
  ]);
  await act(async () => report(45));
  expect(seen[0]).toMatchObject({ kind: 'running', percent: 45 });
  await act(async () => finish());
  expect(seen).toMatchObject([{ kind: 'done', message: '게시물을 올렸어요' }]);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(onSuccess).toHaveBeenCalledWith('ok');
  await act(async () => jest.advanceTimersByTime(2000));
  expect(seen).toEqual([]);
});

test('the task keeps running without any screen: nothing awaits it', async () => {
  const task = jest.fn().mockResolvedValue(undefined);
  await act(async () => {
    runInBackground({ ...base, task });
  });
  await flush();
  expect(task).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([]);
});

test('silent requests show nothing on success', async () => {
  await act(async () => {
    runInBackground({
      ...base,
      silent: true,
      successLabel: '완료',
      task: () => Promise.resolve(),
    });
  });
  await flush();
  expect(seen).toEqual([]);
});

test('a failure keeps the popup with the reason and retry reruns the same task; cleanup waits until it succeeds', async () => {
  const cleanup = jest.fn();
  const task = jest
    .fn()
    .mockRejectedValueOnce(
      new Error('[functions/unavailable] 네트워크가 불안정해요'),
    )
    .mockResolvedValueOnce(undefined);
  await act(async () => {
    runInBackground({ ...base, cleanup, task });
  });
  expect(seen).toMatchObject([
    {
      kind: 'failed',
      message: '게시물을 올리지 못했어요',
      detail: '네트워크가 불안정해요',
      retryable: true,
    },
  ]);
  expect(cleanup).not.toHaveBeenCalled();
  await act(async () => retryBackgroundTask(seen[0].id));
  expect(task).toHaveBeenCalledTimes(2);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([]);
});

test('dismissing a failed task gives up: cleanup runs once and retry does nothing afterwards', async () => {
  const cleanup = jest.fn();
  const task = jest.fn().mockRejectedValue(new Error('실패'));
  await act(async () => {
    runInBackground({ ...base, cleanup, task });
  });
  const id = seen[0].id;
  await act(async () => dismissBackgroundTask(id));
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([]);
  await act(async () => retryBackgroundTask(id));
  expect(task).toHaveBeenCalledTimes(1);
});

test('a non-retryable failure reports the error, rolls the screen back, and then goes away on its own', async () => {
  const onFailure = jest.fn();
  const cleanup = jest.fn();
  await act(async () => {
    runInBackground({
      ...base,
      failureLabel: '응원을 처리하지 못했어요',
      silent: true,
      retryable: false,
      onFailure,
      cleanup,
      describeError: () => '연결을 확인해 주세요',
      task: () => Promise.reject(new Error('x')),
    });
  });
  expect(seen).toMatchObject([
    {
      kind: 'failed',
      message: '응원을 처리하지 못했어요',
      detail: '연결을 확인해 주세요',
      retryable: false,
    },
  ]);
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(cleanup).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(4000));
  expect(seen).toEqual([]);
});

test('onFailure is not called for retryable tasks', async () => {
  const onFailure = jest.fn();
  await act(async () => {
    runInBackground({
      ...base,
      onFailure,
      task: () => Promise.reject(new Error('x')),
    });
  });
  expect(onFailure).not.toHaveBeenCalled();
});
