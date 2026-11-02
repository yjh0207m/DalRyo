export type AppNotification = {
  id: string;
  type: string;
  actor_uid?: string;
  actor_name?: string;
  // 상대 프로필 사진. 이 필드가 생기기 전에 만들어진 알림에는 없다
  actor_image?: string | null;
  // like·comment는 게시물 ID, follow는 팔로워 UID, room_invite는 방 ID
  target_id?: string | null;
  stage?: string;
  level?: string;
  is_read: boolean;
  created_at?: {toMillis?: () => number};
};
