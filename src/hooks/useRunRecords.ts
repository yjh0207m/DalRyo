import {useCallback, useEffect, useState} from 'react';
import type {RunDocument} from '../types/run.types';

type Status = 'loading' | 'success' | 'error';

// 화면의 기간이 바뀌거나 재시도하면 이전 요청의 결과가 새 기록을 덮어쓰지 않게 한다.
export function useRunRecords(load: () => Promise<RunDocument[]>, refreshKey: number | null = null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    load: typeof load;
    attempt: number;
    refreshKey: number | null;
    status: Status;
    runs: RunDocument[];
  } | null>(null);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(load)
      .then(
        runs => {
          if (active) setResult({load, attempt, refreshKey, status: 'success', runs});
        },
        () => {
          if (active) setResult({load, attempt, refreshKey, status: 'error', runs: []});
        },
      );
    return () => {
      active = false;
    };
  }, [load, attempt, refreshKey]);

  const current = result?.load === load && result.attempt === attempt && result.refreshKey === refreshKey ? result : null;
  return {runs: current?.runs ?? [], status: current?.status ?? 'loading', retry};
}
