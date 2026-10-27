export type AppNotification = {
  id: string;
  type: string;
  actor_name?: string;
  stage?: string;
  level?: string;
  is_read: boolean;
  created_at?: {toMillis?: () => number};
};
