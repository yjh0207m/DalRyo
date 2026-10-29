import {createTranslator} from '../src/locales/translate';
import {describeNotification, mergeNotifications} from '../src/utils/notifications';
import type {AppNotification} from '../src/types/notification.types';

const item = (id: string, time: number, is_read = false): AppNotification => ({
  id,
  type: 'level_up',
  is_read,
  created_at: {toMillis: () => time},
});
test('페이지 중복을 제거하고 읽음 변경을 반영하며 최신순으로 합친다', () => {
  const result = mergeNotifications([item('a', 1), item('b', 2)], [item('b', 2, true), item('c', 3)]);
  expect(result.map(row => row.id)).toEqual(['c', 'b', 'a']);
  expect(result[1].is_read).toBe(true);
});
test('동일 시각의 알림도 ID 순서가 안정적이다', () => {
  expect(mergeNotifications([item('a', 1)], [item('b', 1)]).map(row => row.id)).toEqual(['b', 'a']);
});
test('성장 알림의 실제 캐릭터 이름과 단계를 보여준다', () => {
  expect(describeNotification({...item('a', 1), actor_name: '달료', stage: 'child'}, createTranslator('std'))).toEqual({
    title: '달료 성장!',
    body: '어린이 단계로 자랐어요. 함께 달린 덕분이에요!',
  });
});
test('돌 변신 알림은 저장된 말투로 보여준다', () => {
  expect(describeNotification({...item('a', 1), type: 'stone_warning', level: 'stone'}, createTranslator('chung')).title).toBe(
    '달료가 돌이 됐슈!',
  );
});
test('알 수 없는 알림도 목록을 깨뜨리지 않는다', () => {
  expect(describeNotification({...item('a', 1), type: 'new_type'}, createTranslator('std')).title).toBe('달료 알림');
});
test('같이 달리기 요청 알림은 요청한 친구 이름을 보여준다', () => {
  expect(describeNotification({...item('a', 1), type: 'room_invite', actor_name: '민지'}, createTranslator('std'))).toEqual({
    title: '같이 달리기 요청',
    body: '민지님이 같이 달리자고 요청했어요.',
  });
});
