import {FieldValue, getFirestore} from 'firebase-admin/firestore';
import {logger} from 'firebase-functions';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';
import {parkWeekKey} from './parkData';
import {
  addStat,
  calculateRunExp,
  calculateStatGains,
  getCharacterStage,
  laterStage,
  type CharacterStage,
} from './growth';

// 사람이 낼 수 있는 평균 속도를 넘으면(차량 이동 등) 성장에 반영하지 않는다
const MAX_PLAUSIBLE_AVG_KMH = 25;

// F-RUN-03 / F-CHAR-04: 달리기 기록이 저장되면 EXP·누적 거리·스탯·성장 단계를 서버에서 반영한다.
// 클라이언트는 Security Rules상 이 값들을 직접 쓸 수 없다.
export const onRunCreate = onDocumentCreated({document: 'runs/{runId}', region: 'asia-northeast3'}, async event => {
  const snap = event.data;
  if (!snap) {
    return;
  }

  const db = getFirestore();
  const runRef = snap.ref;

  await db.runTransaction(async tx => {
    const runSnap = await tx.get(runRef);
    const run = runSnap.data();

    // 이벤트는 재전달될 수 있으므로 한 번만 반영
    if (!run || run.growth_applied === true) {
      return;
    }

    const uid: string = run.uid;
    const userRef = db.collection('users').doc(uid);
    const characterRef = userRef.collection('character').doc(uid);
    const [userSnap, characterSnap] = await Promise.all([tx.get(userRef), tx.get(characterRef)]);
    const parkRef = typeof run.park_id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(run.park_id)
      ? db.collection('parks').doc(run.park_id) : null;
    const parkSnap = parkRef ? await tx.get(parkRef) : null;

    if (!userSnap.exists) {
      logger.warn('run without user document', {runId: runRef.id, uid});
      tx.update(runRef, {growth_applied: true});
      return;
    }

    const distanceKm = Number(run.distance_km) || 0;
    const durationSec = Number(run.duration_sec) || 0;
    const avgSpeedKmh = Number(run.avg_speed_kmh) || 0;
    const suspicious = avgSpeedKmh > MAX_PLAUSIBLE_AVG_KMH;
    const countedKm = suspicious ? 0 : distanceKm;
    const expEarned = calculateRunExp(countedKm);
    const totalKmAfter = (Number(userSnap.get('total_km')) || 0) + countedKm;
    const now = FieldValue.serverTimestamp();

    tx.update(runRef, {exp_earned: expEarned, growth_applied: true, flagged: suspicious});

    // 달리기만 해도 돌 변신은 풀린다 (거리 0이어도 마지막 달리기 시각은 갱신)
    tx.update(userRef, {
      total_km: FieldValue.increment(countedKm),
      total_exp: FieldValue.increment(expEarned),
      last_run_at: now,
      is_frozen: false,
      updated_at: now,
    });
    if (parkSnap?.exists && parkRef && countedKm > 0) {
      const week = parkWeekKey(run.started_at.toDate());
      tx.set(parkRef.collection('weeks').doc(week).collection('runners').doc(uid), {
        uid, display_name: userSnap.get('display_name'), profile_image: userSnap.get('profile_image') ?? null,
        distance_km: FieldValue.increment(countedKm), run_count: FieldValue.increment(1), updated_at: now,
      }, {merge:true});
    }

    if (!characterSnap.exists) {
      return;
    }

    const prevStage = (characterSnap.get('stage') as CharacterStage) ?? 'egg';
    const nextStage = laterStage(prevStage, getCharacterStage(totalKmAfter));
    const gains = suspicious ? {stamina: 0, speed: 0, endurance: 0} : calculateStatGains({distanceKm, avgSpeedKmh, durationSec});

    tx.update(characterRef, {
      stage: nextStage,
      exp: FieldValue.increment(expEarned),
      stat_stamina: addStat(characterSnap.get('stat_stamina'), gains.stamina),
      stat_speed: addStat(characterSnap.get('stat_speed'), gains.speed),
      stat_endurance: addStat(characterSnap.get('stat_endurance'), gains.endurance),
      last_active_at: now,
      updated_at: now,
    });

    if (nextStage !== prevStage) {
      tx.create(userRef.collection('notifications').doc(), {
        type: 'level_up',
        actor_uid: uid,
        actor_name: characterSnap.get('pet_name') ?? '',
        target_id: null,
        stage: nextStage,
        is_read: false,
        created_at: now,
      });
    }
  });
});
