import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  Bell,
  Footprints,
  MessageCircle,
  Mountain,
  Settings,
  Snowflake,
  TrendingUp,
  UserPlus,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { RunningShoeIcon } from '../../components/ui/RunningShoeIcon';
import { colors } from '../../theme';
import type { AppNotification } from '../../types/notification.types';
import { PERSON_NOTIFICATION_TYPES } from '../../utils/notifications';

const SIZE = 48;
const BADGE = 20;

// 알림 왼쪽의 동그라미. 사람이 한 행동이면 그 사람의 프로필 사진(없으면 사람 아이콘)에 행동을 나타내는 작은 아이콘을
// 붙이고, 성장·돌 변신·설정 같은 시스템 알림은 성격에 맞는 아이콘을 보여 준다
export function NotificationAvatar({ item }: { item: AppNotification }) {
  const person = PERSON_NOTIFICATION_TYPES.includes(item.type);
  return (
    // 알림 전체의 읽기 문구가 따로 있어 장식으로만 쓴다
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.wrap}
    >
      {person ? <PersonCircle item={item} /> : <SystemCircle item={item} />}
    </View>
  );
}

function PersonCircle({ item }: { item: AppNotification }) {
  return (
    <>
      <View style={[styles.circle, styles.personCircle]}>
        {item.actor_image ? (
          <Image source={{ uri: item.actor_image }} style={styles.photo} />
        ) : (
          <UserRound color={colors.primaryInk} size={24} strokeWidth={2} />
        )}
      </View>
      <View style={styles.badge}>{actionIcon(item.type)}</View>
    </>
  );
}

function actionIcon(type: string) {
  const color = colors.primaryInk;
  if (type === 'like') return <RunningShoeIcon size={13} color={color} />;
  const Icon: LucideIcon =
    type === 'comment'
      ? MessageCircle
      : type === 'follow'
      ? UserPlus
      : Footprints;
  return <Icon color={color} size={12} strokeWidth={2.2} />;
}

function SystemCircle({ item }: { item: AppNotification }) {
  const { Icon, tint, background } = systemLook(item);
  return (
    <View style={[styles.circle, { backgroundColor: background }]}>
      <Icon color={tint} size={24} strokeWidth={2} />
    </View>
  );
}

function systemLook(item: AppNotification): {
  Icon: LucideIcon;
  tint: string;
  background: string;
} {
  if (item.type === 'level_up')
    return {
      Icon: TrendingUp,
      tint: colors.primaryInk,
      background: colors.primarySoft,
    };
  if (item.type === 'stone_warning')
    return item.level === 'stone'
      ? { Icon: Mountain, tint: colors.textMuted, background: colors.stoneSoft }
      : {
          Icon: Snowflake,
          tint: colors.accentInk,
          background: colors.accentSoft,
        };
  if (item.type === 'settings')
    return {
      Icon: Settings,
      tint: colors.textMuted,
      background: colors.surfaceMuted,
    };
  return {
    Icon: Bell,
    tint: colors.textMuted,
    background: colors.surfaceMuted,
  };
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  personCircle: { backgroundColor: colors.primarySoft },
  photo: { width: SIZE, height: SIZE },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
