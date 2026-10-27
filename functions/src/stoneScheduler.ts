import {FieldValue, getFirestore, Timestamp} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';
import {logger} from 'firebase-functions';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {getDaysSinceRun, getStoneNotice, type StoneNotice} from './growth';

type DialectGroup = 'std' | 'gyeong' | 'jeon' | 'chung' | 'jeju';

// README 5-8 사투리 문구. 5일 경고는 아직 표준어만 정의돼 있다
const MESSAGES: Record<StoneNotice, Record<DialectGroup, string>> = {
  warn3: {
    std: '달료가 뻣뻣해졌어요... 빨리 달려주세요!',
    gyeong: '달료가 굳어뿌고 있다 아이가',
    jeon: '달료가 굳어부렸당께',
    chung: '달료가 굳어가고 있슈',
    jeju: '달료가 굳어가고 있수다',
  },
  warn5: {
    std: '달료 몸이 회색이 되고 있어요…',
    gyeong: '달료 몸이 회색이 되고 있어요…',
    jeon: '달료 몸이 회색이 되고 있어요…',
    chung: '달료 몸이 회색이 되고 있어요…',
    jeju: '달료 몸이 회색이 되고 있어요…',
  },
  stone: {
    std: '달료가 돌이 됐어요 🪨 오늘 달리면 해동돼요!',
    gyeong: '달료가 돌 됐다 아이가! 🪨',
    jeon: '달료가 돌 돼부렸당께! 🪨',
    chung: '달료가 돌이 됐슈! 🪨',
    jeju: '달료가 돌 됐수다! 🪨',
  },
};

function toDialectGroup(dialect: unknown): DialectGroup {
  if (dialect === 'gyeong' || dialect === 'jeon' || dialect === 'chung' || dialect === 'jeju') {
    return dialect;
  }
  // std·seoul·gyeonggi·gangwon은 표준어
  return 'std';
}

// F-CHAR-05: 매일 자정(KST) 마지막 달리기 기준으로 경고 알림·돌 변신 처리
export const stoneScheduler = onSchedule(
  {schedule: 'every day 00:00', timeZone: 'Asia/Seoul', region: 'asia-northeast3'},
  async () => {
    const db = getFirestore();
    const now = Date.now();
    const threeDaysAgo = Timestamp.fromMillis(now - 3 * 86_400_000);

    // last_run_at 단일 필드 범위 쿼리 (복합 인덱스 불필요), is_frozen은 코드에서 거른다
    const snap = await db.collection('users').where('last_run_at', '<=', threeDaysAgo).get();
    const writer = db.bulkWriter();
    const pushes: Promise<unknown>[] = [];
    let frozen = 0;
    let warned = 0;

    for (const userDoc of snap.docs) {
      const user = userDoc.data();
      if (user.is_frozen === true) {
        continue;
      }

      const lastRunAt = user.last_run_at as Timestamp | undefined;
      const notice = getStoneNotice(getDaysSinceRun(lastRunAt ? lastRunAt.toMillis() : null, now));
      if (!notice) {
        continue;
      }

      if (notice === 'stone') {
        writer.update(userDoc.ref, {is_frozen: true, updated_at: FieldValue.serverTimestamp()});
        frozen += 1;
      } else {
        warned += 1;
      }

      writer.create(userDoc.ref.collection('notifications').doc(), {
        type: 'stone_warning',
        actor_uid: userDoc.id,
        actor_name: '',
        target_id: null,
        level: notice,
        is_read: false,
        created_at: FieldValue.serverTimestamp(),
      });

      const body = MESSAGES[notice][toDialectGroup(user.dialect)];
      if (typeof user.fcm_token === 'string' && user.fcm_token) {
        pushes.push(
          getMessaging()
            .send({
              token: user.fcm_token,
              notification: {title: '달료', body},
              android: {priority: 'high'},
              apns: {payload: {aps: {sound: 'default'}}},
            })
            .catch(error => logger.warn('stone push failed', {uid: userDoc.id, code: error?.code})),
        );
      }
    }

    await writer.close();
    await Promise.all(pushes);
    logger.info('stoneScheduler done', {scanned: snap.size, frozen, warned});
  },
);
