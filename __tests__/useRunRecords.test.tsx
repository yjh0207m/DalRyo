import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {useRunRecords} from '../src/hooks/useRunRecords';
import type {RunDocument} from '../src/types/run.types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

// 조회 실패, 빈 결과, 기간 전환과 요청 순서 역전을 실제 React 수명 주기에서 검증한다.
describe('달리기 기록 조회 상태', () => {
  let renderer: ReactTestRenderer;
  let current: ReturnType<typeof useRunRecords>;
  const sample = [{run_id: 'run-1', distance_km: 3}] as RunDocument[];

  function Probe({load, refreshKey}: {load: () => Promise<RunDocument[]>; refreshKey?: number}) {
    current = useRunRecords(load, refreshKey);
    return null;
  }

  afterEach(async () => {
    await act(async () => renderer?.unmount());
  });

  test('로딩 중에는 0인 통계로 확정하지 않고, 빈 응답은 성공으로 처리한다', async () => {
    const request = deferred<RunDocument[]>();
    await act(async () => {
      renderer = create(<Probe load={() => request.promise} />);
    });
    expect(current.status).toBe('loading');
    await act(async () => request.resolve([]));
    expect(current.status).toBe('success');
    expect(current.runs).toEqual([]);
  });

  test('실패를 표시하고 재시도하면 기록을 다시 불러온다', async () => {
    const load = jest.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(sample);
    await act(async () => {
      renderer = create(<Probe load={load} />);
    });
    expect(current.status).toBe('error');
    await act(async () => current.retry());
    expect(load).toHaveBeenCalledTimes(2);
    expect(current.status).toBe('success');
    expect(current.runs).toEqual(sample);
  });

  test('기간 변경 뒤 늦게 도착한 이전 요청은 무시한다', async () => {
    const previous = deferred<RunDocument[]>();
    const next = deferred<RunDocument[]>();
    await act(async () => {
      renderer = create(<Probe load={() => previous.promise} />);
    });
    await act(async () => renderer.update(<Probe load={() => next.promise} />));
    await act(async () => next.resolve(sample));
    await act(async () => previous.resolve([]));
    expect(current.status).toBe('success');
    expect(current.runs).toEqual(sample);
  });

  test('기간 변경 시 이전 기간의 통계를 숨기고 새 요청의 실패를 표시한다', async () => {
    const request = deferred<RunDocument[]>();
    await act(async () => {
      renderer = create(<Probe load={() => Promise.resolve(sample)} />);
    });
    await act(async () => renderer.update(<Probe load={() => request.promise} />));
    expect(current.status).toBe('loading');
    expect(current.runs).toEqual([]);
    await act(async () => request.reject(new Error('missing index')));
    expect(current.status).toBe('error');
    expect(current.runs).toEqual([]);
  });

  test('새 달리기가 반영되면 같은 조회 함수로 다시 요청한다', async () => {
    const load = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(sample);
    await act(async () => {
      renderer = create(<Probe load={load} refreshKey={1} />);
    });
    await act(async () => renderer.update(<Probe load={load} refreshKey={2} />));
    expect(load).toHaveBeenCalledTimes(2);
    expect(current.runs).toEqual(sample);
  });
});
