import type {AppNotification} from '../types/notification.types';
import type {Translate} from '../locales/translate';

export function notificationTime(item: AppNotification) {
  return item.created_at?.toMillis?.() ?? 0;
}

export function mergeNotifications(existing: AppNotification[], incoming: AppNotification[]) {
  const byId = new Map(existing.map(item => [item.id, item]));
  incoming.forEach(item => byId.set(item.id, item));
  return [...byId.values()].sort((a, b) => notificationTime(b) - notificationTime(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

// 알림을 눌렀을 때 갈 곳
export type NotificationTarget =
  | {kind: 'post'; postId: string}
  | {kind: 'profile'; uid: string}
  | {kind: 'together'}
  | {kind: 'growth'}
  | {kind: 'home'}
  | {kind: 'settings'};

function text(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

// 갈 곳을 알 수 없으면(옛 알림에 대상 정보가 없는 등) null. 그때는 안내 창만 보여 준다
export function notificationTarget(item: AppNotification): NotificationTarget | null {
  switch (item.type) {
    case 'like':
    case 'comment': {
      const postId = text(item.target_id);
      return postId ? {kind: 'post', postId} : null;
    }
    case 'follow': {
      const uid = text(item.actor_uid) ?? text(item.target_id);
      return uid ? {kind: 'profile', uid} : null;
    }
    case 'room_invite':
      return {kind: 'together'};
    case 'level_up':
      return {kind: 'growth'};
    case 'stone_warning':
      return {kind: 'home'};
    case 'settings':
      return {kind: 'settings'};
    default:
      return null;
  }
}

// 사람이 한 행동이라 상대 프로필 사진을 보여 주는 알림
export const PERSON_NOTIFICATION_TYPES = ['follow', 'like', 'comment', 'room_invite'];

export function describeNotification(item: AppNotification, t: Translate) {
  if (item.type === 'level_up') {
    const stages: Record<string, string> = {baby: '아기', child: '어린이', runner: '러너'};
    return {
      title: `${item.actor_name || '달료'} 성장!`,
      body: stages[item.stage ?? ''] ? `${stages[item.stage!]} 단계로 자랐어요. 함께 달린 덕분이에요!` : '캐릭터가 한 단계 성장했어요!',
    };
  }
  if (item.type === 'stone_warning') {
    if (item.level === 'stone') return {title: t('char.stone'), body: t('char.stoneBody')};
    if (item.level === 'warn5') return {title: t('char.warn5'), body: t('char.warn5Body')};
    return {title: t('char.warn3'), body: t('char.warn3Body')};
  }
  const actor = item.actor_name || '달리너';
  if (item.type === 'follow') return {title: '새로운 팔로워', body: `${actor}님이 나를 팔로우했어요.`};
  if (item.type === 'like') return {title: '응원이 도착했어요', body: `${actor}님이 내 달리기를 응원했어요.`};
  if (item.type === 'room_invite') return {title: '같이 달리기 요청', body: `${actor}님이 같이 달리자고 요청했어요.`};
  if (item.type === 'comment') return {title: '새 댓글이 달렸어요', body: `${actor}님이 댓글을 남겼어요.`};
  return {title: '달료 알림', body: '새로운 소식이 도착했어요.'};
}
