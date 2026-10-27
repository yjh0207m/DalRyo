import {useEffect, useState} from 'react';

// 숫자가 0에서 목표값까지 흘러가듯 올라간다 (빠르게 출발해 천천히 멈춤).
// start가 true가 되는 순간 시작하고, 끝나면 정확히 목표값에 멈춘다.
export function useCountUp(target: number, start: boolean, durationMs = 900) {
  const [value, setValue] = useState(start ? 0 : 0);

  useEffect(() => {
    if (!start) {
      setValue(0);
      return undefined;
    }
    let frame = 0;
    const began = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - began) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, start, durationMs]);

  return value;
}
