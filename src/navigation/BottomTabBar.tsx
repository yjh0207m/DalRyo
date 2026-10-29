import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarDays,
  Footprints,
  House,
  MessageCircle,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';
import { AppText } from '../components/ui';
import { colors, radius, spacing } from '../theme';
export type MainTab =
  | 'home'
  | 'growth'
  | 'run'
  | 'community'
  | 'records'
  | 'my';
const TABS: Array<{
  key: Exclude<MainTab, 'run' | 'my'>;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'home', label: '홈', icon: House },
  { key: 'growth', label: '성장', icon: TrendingUp },
  { key: 'community', label: '커뮤니티', icon: MessageCircle },
  { key: 'records', label: '기록', icon: CalendarDays },
];
export const TAB_BAR_HEIGHT = 88;
export function BottomTabBar({
  activeTab,
  onChange,
}: {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { bottom: Math.max(insets.bottom, 12) }]}>
      {TABS.slice(0, 2).map(tab => (
        <TabItem
          key={tab.key}
          label={tab.label}
          icon={tab.icon}
          active={activeTab === tab.key}
          onPress={() => onChange(tab.key)}
        />
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="달리기 시작"
        onPress={() => onChange('run')}
        style={({ pressed }) => [styles.run, pressed && styles.pressed]}
      >
        <Footprints color={colors.text} size={25} strokeWidth={2} />
        <AppText variant="label" color={colors.text} style={styles.label}>
          달리기
        </AppText>
      </Pressable>
      {TABS.slice(2).map(tab => (
        <TabItem
          key={tab.key}
          label={tab.label}
          icon={tab.icon}
          active={activeTab === tab.key}
          onPress={() => onChange(tab.key)}
        />
      ))}
    </View>
  );
}
function TabItem({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <Icon
        color={active ? colors.primary : colors.textSubtle}
        size={21}
        strokeWidth={active ? 2.4 : 1.7}
      />
      <AppText
        variant="label"
        color={active ? colors.primary : colors.textMuted}
        style={styles.label}
      >
        {label}
      </AppText>
      {active && <View style={styles.marker} />}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    height: 70,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 25,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  tab: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: { fontSize: 10, lineHeight: 14 },
  marker: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  run: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    marginHorizontal: 3,
  },
  pressed: { opacity: 0.65 },
});
