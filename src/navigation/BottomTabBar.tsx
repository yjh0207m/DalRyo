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
import { colors } from '../theme';
export type MainTab = 'home' | 'growth' | 'run' | 'community' | 'records';
const TABS: Array<{
  key: Exclude<MainTab, 'run'>;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'home', label: '홈', icon: House },
  { key: 'growth', label: '성장', icon: TrendingUp },
  { key: 'community', label: '커뮤니티', icon: MessageCircle },
  { key: 'records', label: '기록', icon: CalendarDays },
];
export const TAB_BAR_HEIGHT = 60;
// 메뉴를 올릴 때는 본체 높이와 시스템 탐색 영역을 함께 더한다.
export const TAB_BAR_BODY_HEIGHT = TAB_BAR_HEIGHT;
export const tabBarBottom = (insetBottom: number) => insetBottom;
const RUN_BUTTON_DIAMETER = 56;
export function BottomTabBar({
  activeTab,
  onChange,
}: {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {TABS.slice(0, 2).map(tab => (
          <TabItem
            key={tab.key}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.key}
            onPress={() => onChange(tab.key)}
          />
        ))}
        <View style={styles.runSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="달리기 시작"
            onPress={() => onChange('run')}
            style={({ pressed }) => [styles.run, pressed && styles.runPressed]}
          >
            <Footprints
              color={colors.textOnPrimary}
              size={26}
              strokeWidth={2.2}
            />
            <AppText
              variant="label"
              color={colors.textOnPrimary}
              style={styles.runLabel}
            >
              달리기
            </AppText>
          </Pressable>
        </View>
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
        color={active ? colors.primaryInk : colors.textMuted}
        size={21}
        strokeWidth={active ? 2.4 : 1.7}
      />
      <AppText
        variant="label"
        color={active ? colors.primaryInk : colors.textMuted}
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
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    height: TAB_BAR_BODY_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
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
  runSlot: { flex: 1.2, alignItems: 'center' },
  run: {
    width: RUN_BUTTON_DIAMETER,
    height: RUN_BUTTON_DIAMETER,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    backgroundColor: colors.primaryAction,
    borderRadius: RUN_BUTTON_DIAMETER / 2,
  },
  runLabel: { fontSize: 11, lineHeight: 14 },
  runPressed: { backgroundColor: colors.primaryInk },
  pressed: { opacity: 0.65 },
});
