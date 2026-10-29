import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {commandRun, readActiveRun} from '../services/runJournal.service';
import {pendingRuns, uploadPendingRun} from '../services/runOutbox.service';
import type {RunSessionSnapshot} from '../types/runSession';

export function useRunRecovery(uid?: string) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [active, setActive] = useState<RunSessionSnapshot | null>(null);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const epoch = useRef(0), lock = useRef(false);
  const owner = useRef(uid); owner.current = uid;
  const refresh = useCallback(async () => {
    if (!uid || owner.current !== uid) return;
    const revision = epoch.current;
    try {
      const [session, queue] = await Promise.all([readActiveRun(uid), pendingRuns(uid)]);
      const copied = session?.phase === 'finished' && queue.some(run => run.id === `${uid}_${session.startedAtMs}`);
      if (copied) await commandRun(session!, 'clear');
      if (revision === epoch.current) {setActive(copied ? null : session); setPending(queue.length); setStatus('ready');}
    } catch {if (revision === epoch.current) setStatus('error');}
  }, [uid]);
  const sync = useCallback(async () => {
    if (!uid || owner.current !== uid || lock.current) return;
    lock.current = true;
    const revision = epoch.current;
    setSyncing(true);
    try {
      for (const entry of await pendingRuns(uid)) {
        if (revision !== epoch.current) break;
        await uploadPendingRun(uid, entry.id);
      }
    } catch { /* Keep the durable copy and retry when active/connected. */ }
    finally {
      lock.current = false;
      if (revision === epoch.current) {setSyncing(false); refresh();}
    }
  }, [uid, refresh]);
  useEffect(() => {
    const generation = ++epoch.current; setStatus('loading'); setActive(null); setPending(0);
    refresh().then(() => {if (generation === epoch.current) sync();});
    const interval = setInterval(() => {if (AppState.currentState === 'active') sync();}, 15000);
    const subscription = AppState.addEventListener('change', state => {if (state === 'active') sync();});
    return () => {
      epoch.current = generation + 1; clearInterval(interval); subscription.remove();
      // An account change must not keep recording the previous account's GPS.
      if (uid) readActiveRun(uid).then(session => session?.phase === 'running' ? commandRun(session, 'pause') : undefined).catch(() => {});
    };
  }, [uid, refresh, sync]);
  return {status, active, pending, syncing, refresh, sync, dismiss: () => setActive(null)};
}
