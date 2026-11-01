import { useSyncExternalStore } from 'react';

// 서버 응답을 기다릴 필요가 없는 요청을 화면과 상관없이 뒤에서 처리하는 장치.
// 화면은 요청을 맡기자마자 다음으로 넘어가고, 진행·완료·실패는 작은 팝업(BackgroundTaskToast)으로만 알린다.
// 상태를 화면이 아닌 모듈에 두므로 요청을 시작한 화면이 사라져도 계속 진행된다.

export type BackgroundToast = {
  id: number;
  kind: 'running' | 'done' | 'failed';
  message: string;
  detail?: string;
  percent: number | null;
  retryable: boolean;
};

type Options<T> = {
  // 진행 중 팝업 문구 (예: '게시물 올리는 중')
  label: string;
  // 완료 팝업 문구. 없으면 완료 팝업을 띄우지 않는다
  successLabel?: string;
  // 실패 팝업 문구
  failureLabel: string;
  task: (report: (percent: number) => void) => Promise<T>;
  // true면 진행 중에는 아무것도 띄우지 않고 실패했을 때만 알린다 (좋아요처럼 가벼운 요청)
  silent?: boolean;
  // 기본값 true. 실패하면 팝업에 '다시 시도'를 두고 같은 작업을 다시 실행한다.
  // false면 다시 시도 없이 onFailure로 화면 상태를 되돌리고 오류만 잠깐 알린다
  retryable?: boolean;
  describeError?: (error: unknown) => string;
  onSuccess?: (result: T) => void;
  // retryable이 false일 때만 호출된다 (낙관적으로 바꿔 둔 화면을 되돌리는 용도)
  onFailure?: (error: unknown) => void;
  // 성공했거나 다시 시도를 포기(닫기)했을 때 한 번 호출된다 (임시 파일 정리 등)
  cleanup?: () => void;
};

type Entry = {
  options: Options<unknown>;
  settled: boolean;
};

const DONE_VISIBLE_MS = 2000;
const FAILED_VISIBLE_MS = 4000;

let nextId = 1;
let toasts: BackgroundToast[] = [];
const entries = new Map<number, Entry>();
const timers = new Set<ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}
function setToast(toast: BackgroundToast) {
  toasts = toasts.some(item => item.id === toast.id)
    ? toasts.map(item => (item.id === toast.id ? toast : item))
    : [...toasts, toast];
  emit();
}
function removeToast(id: number) {
  if (!toasts.some(item => item.id === id)) return;
  toasts = toasts.filter(item => item.id !== id);
  emit();
}
function removeLater(id: number, ms: number) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    removeToast(id);
  }, ms);
  timers.add(timer);
}
function defaultError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^\[functions\/[^\]]+\]\s*/, '')
    : '잠시 후 다시 시도해 주세요.';
}

async function execute(id: number) {
  const entry = entries.get(id);
  if (!entry || entry.settled) return;
  const { options } = entry;
  const retryable = options.retryable !== false;
  const show = (
    change: Partial<BackgroundToast> &
      Pick<BackgroundToast, 'kind' | 'message'>,
  ) => setToast({ id, percent: null, retryable, ...change });
  if (!options.silent) show({ kind: 'running', message: options.label });
  try {
    const result = await options.task(percent => {
      if (!options.silent && entries.has(id) && !entry.settled)
        show({ kind: 'running', message: options.label, percent });
    });
    entry.settled = true;
    entries.delete(id);
    options.cleanup?.();
    if (options.successLabel && !options.silent) {
      show({ kind: 'done', message: options.successLabel });
      removeLater(id, DONE_VISIBLE_MS);
    } else removeToast(id);
    options.onSuccess?.(result);
  } catch (error) {
    const detail = (options.describeError ?? defaultError)(error);
    if (retryable) {
      show({ kind: 'failed', message: options.failureLabel, detail });
      return;
    }
    entry.settled = true;
    entries.delete(id);
    options.cleanup?.();
    show({ kind: 'failed', message: options.failureLabel, detail });
    removeLater(id, FAILED_VISIBLE_MS);
    options.onFailure?.(error);
  }
}

export function runInBackground<T>(options: Options<T>) {
  const id = nextId++;
  entries.set(id, { options: options as Options<unknown>, settled: false });
  execute(id);
}

// 실패한 작업을 같은 내용으로 다시 실행한다
export function retryBackgroundTask(id: number) {
  const entry = entries.get(id);
  if (entry && !entry.settled) execute(id);
}

// 실패한 작업을 포기하고 팝업을 닫는다
export function dismissBackgroundTask(id: number) {
  const entry = entries.get(id);
  if (entry && !entry.settled) {
    entry.settled = true;
    entries.delete(id);
    entry.options.cleanup?.();
  }
  removeToast(id);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getSnapshot = () => toasts;

export function useBackgroundToasts() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// 테스트에서 상태를 비울 때 쓴다
export function resetBackgroundTasks() {
  timers.forEach(clearTimeout);
  timers.clear();
  entries.clear();
  toasts = [];
  emit();
}
