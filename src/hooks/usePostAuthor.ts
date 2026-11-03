import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { firestore } from '../lib/firebase';
import {
  myUid,
  socialRequest,
  type PublicProfile,
} from '../services/social.service';

type Author = Pick<PublicProfile, 'display_name' | 'profile_image'>;
type Entry = {
  value?: Author;
  listeners: Set<(value: Author) => void>;
  stop?: () => void;
  revision: number;
};
const entries = new Map<string, Entry>();
const queued = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

function publish(uid: string, value: Author, expected?: Entry) {
  const entry = entries.get(uid);
  if (!entry || (expected && entry !== expected)) return;
  entry.value = value;
  entry.listeners.forEach(listener => listener(value));
}

// One public lookup per author, shared by every visible post from that runner.
function queue(uid: string) {
  const entry = entries.get(uid);
  if (!entry) return;
  entry.revision++;
  queued.add(uid);
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    const ids = [...queued];
    queued.clear();
    for (let offset = 0; offset < ids.length; offset += 30) {
      const uids = ids.slice(offset, offset + 30);
      const expected = new Map(uids.map(id => [id, entries.get(id)]));
      const revisions = new Map(
        uids.map(id => [id, entries.get(id)?.revision]),
      );
      socialRequest<{ users: PublicProfile[] }>('publicProfiles', { uids })
        .then(result =>
          result.users.forEach(user => {
            if (entries.get(user.uid)?.revision === revisions.get(user.uid))
              publish(user.uid, user, expected.get(user.uid));
          }),
        )
        .catch(() => {}); // Keep the post's saved identity during an offline lookup.
    }
  }, 0);
}

export function usePostAuthor(uid: string | undefined, refreshKey?: unknown) {
  const [result, setResult] = useState<{ uid: string; author: Author }>();
  useEffect(() => {
    if (!uid) return undefined;
    const setAuthor = (author: Author) => setResult({ uid, author });
    let entry = entries.get(uid);
    if (!entry) {
      entry = { listeners: new Set(), revision: 0 };
      entries.set(uid, entry);
    }
    if (uid !== myUid()) queue(uid);
    if (entry.value) setAuthor(entry.value);
    entry.listeners.add(setAuthor);
    // Only the owner may read this private document. Other identities use the public DTO.
    if (uid === myUid() && !entry.stop) {
      entry.stop = firestore()
        .collection('users')
        .doc(uid)
        .onSnapshot(
          snapshot => {
            const data = snapshot.data();
            if (data)
              publish(uid, {
                display_name: data.display_name,
                profile_image: data.profile_image ?? null,
              });
          },
          () => {},
        );
    }
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active' && uid !== myUid()) queue(uid);
    });
    return () => {
      foreground.remove();
      entry.listeners.delete(setAuthor);
      if (!entry.listeners.size) {
        entry.stop?.();
        entries.delete(uid);
      }
    };
  }, [uid, refreshKey]);
  return result?.uid === uid ? result?.author : undefined;
}
