import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  coordinate,
  parseOsmParks,
  parkDistance,
  parkWeekKey,
  type ParkData,
} from './parkData';
import { documentId } from './validation';
const DAY = 86400000;
export const parkAction = onCall(
  {
    region: 'asia-northeast3',
    maxInstances: 3,
    concurrency: 4,
    timeoutSeconds: 45,
  },
  async request => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '로그인이 필요해요.');
    const input = request.data ?? {},
      db = getFirestore();
    try {
      if (input.action === 'nearby') {
        const position = {
          lat: coordinate(input.lat, true),
          lng: coordinate(input.lng, false),
        };
        const center = {
          lat: Math.round(position.lat * 100) / 100,
          lng: Math.round(position.lng * 100) / 100,
        };
        const cacheRef = db
          .collection('park_search_cache')
          .doc(`${center.lat}_${center.lng}`);
        const cache = (await cacheRef.get()).data();
        let parks = cache?.parks as ParkData[] | undefined;
        let stale = false;
        if (!parks || Date.now() - (cache?.updated_at?.toMillis() ?? 0) > DAY) {
          const rate = db
            .collection('users')
            .doc(request.auth.uid)
            .collection('park_search')
            .doc('rate');
          await db.runTransaction(async tx => {
            const old = await tx.get(rate);
            if (Date.now() - (old.get('at')?.toMillis() ?? 0) < 30000)
              throw new HttpsError(
                'resource-exhausted',
                '잠시 후 다시 검색해 주세요.',
              );
            tx.set(rate, { at: FieldValue.serverTimestamp() });
          });
          try {
            const response = await fetch(
              'https://overpass.private.coffee/api/interpreter',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'User-Agent':
                    'DalRyo/0.1 (+https://dalryo-dev.firebaseapp.com)',
                },
                body: `data=${encodeURIComponent(
                  `[out:json][timeout:20];nwr[leisure=park][name][access!~"private|no"](around:11000,${center.lat},${center.lng});out center tags;`,
                )}`,
                signal: AbortSignal.timeout(25000),
              },
            );
            if (!response.ok) throw new Error(`provider-${response.status}`);
            const raw = await response.text();
            if (raw.length > 2000000)
              throw new Error('provider-response-too-large');
            parks = parseOsmParks(JSON.parse(raw))
              .sort((a, b) => parkDistance(center, a) - parkDistance(center, b))
              .slice(0, 200);
            const batch = db.batch();
            for (const park of parks)
              batch.set(db.collection('parks').doc(park.park_id), park, {
                merge: true,
              });
            batch.set(cacheRef, {
              parks,
              updated_at: FieldValue.serverTimestamp(),
            });
            await batch.commit();
          } catch (error) {
            logger.warn('park provider unavailable', {
              reason: error instanceof Error ? error.message : 'unknown',
            });
            if (
              !parks ||
              Date.now() - (cache?.updated_at?.toMillis() ?? 0) > 7 * DAY
            )
              throw new HttpsError(
                'unavailable',
                '공원 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
              );
            stale = true;
          }
        }
        return {
          parks: parks
            .map(park => ({
              ...park,
              distance_km: parkDistance(position, park),
            }))
            .filter(park => park.distance_km <= 10)
            .sort((a, b) => a.distance_km - b.distance_km)
            .slice(0, 50),
          stale,
        };
      }
      const id = documentId(input.parkId),
        ref = db.collection('parks').doc(id),
        park = await ref.get();
      if (!park.exists)
        throw new HttpsError('not-found', '공원 정보를 찾을 수 없어요.');
      if (input.action === 'courses') {
        const snap = await ref
          .collection('courses')
          .orderBy('distance_km')
          .limit(30)
          .get();
        return {
          courses: snap.docs
            .filter(
              doc =>
                typeof doc.get('distance_km') === 'number' &&
                doc.get('distance_km') > 0 &&
                doc.get('distance_km') <= 100,
            )
            .map(doc => {
              const data = doc.data(),
                route = Array.isArray(data.route) ? data.route : [];
              return {
                course_id: doc.id,
                name:
                  typeof data.name === 'string'
                    ? data.name.slice(0, 100)
                    : `${data.distance_km}km 코스`,
                distance_km: data.distance_km,
                route: route
                  .slice(0, 1500)
                  .flatMap(
                    (p: {
                      lat?: unknown;
                      lng?: unknown;
                      latitude?: unknown;
                      longitude?: unknown;
                    }) => {
                      try {
                        return [
                          {
                            lat: coordinate(p.lat ?? p.latitude, true),
                            lng: coordinate(p.lng ?? p.longitude, false),
                            timestamp: 0,
                          },
                        ];
                      } catch {
                        return [];
                      }
                    },
                  ),
              };
            }),
        };
      }
      if (input.action === 'rankings') {
        const week = parkWeekKey(new Date()),
          snap = await ref
            .collection('weeks')
            .doc(week)
            .collection('runners')
            .orderBy('distance_km', 'desc')
            .limit(50)
            .get();
        return {
          week,
          runners: snap.docs.map(doc => ({
            uid: doc.id,
            display_name: doc.get('display_name'),
            profile_image: doc.get('profile_image') ?? null,
            distance_km: doc.get('distance_km'),
            run_count: doc.get('run_count'),
          })),
        };
      }
      throw new Error('지원하지 않는 공원 작업이에요.');
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        'invalid-argument',
        error instanceof Error ? error.message : '입력값을 확인해 주세요.',
      );
    }
  },
);
