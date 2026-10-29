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
