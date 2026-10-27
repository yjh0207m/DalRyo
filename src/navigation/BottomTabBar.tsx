import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CalendarDays, Footprints, House, MessageCircle, TrendingUp, type LucideIcon} from 'lucide-react-native';
import {AppText} from '../components/ui';
import {colors, radius, spacing} from '../theme';

// 'my'는 탭이 아니라 헤더의 설정 버튼으로 들어간다
export type MainTab = 'home' | 'growth' | 'run' | 'community' | 'records' | 'my';

// Figma UI 구성: 홈 · 성장 리포트 · (달리기) · 커뮤니티 · 기록
const TABS: Array<{key: Exclude<MainTab, 'run' | 'my'>; label: string; icon: LucideIcon}> = [
  {key: 'home', label: '홈', icon: House},
  {key: 'growth', label: '성장', icon: TrendingUp},
  {key: 'community', label: '커뮤니티', icon: MessageCircle},
  {key: 'records', label: '기록', icon: CalendarDays},
];

export const TAB_BAR_HEIGHT = 68;

type Props = {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
};

const RUN_SIZE = 66;
const RUN_LIP = 5;

export function BottomTabBar({activeTab, onChange}: Props) {
  const insets = useSafeAreaInsets();
  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)];

  return (
    <View style={[styles.bar, {paddingBottom: Math.max(insets.bottom, spacing.sm)}]}>
      {left.map(tab => (
        <TabItem key={tab.key} label={tab.label} icon={tab.icon} active={activeTab === tab.key} onPress={() => onChange(tab.key)} />
      ))}
      <View style={styles.runSlot}>
        {/* 게임식 입체 원형 버튼: 아래 턱 위에 버튼 면이 올라가 있고, 누르면 눌려 내려간다 */}
        <Pressable accessibilityRole="button" accessibilityLabel="달리기 시작" onPress={() => onChange('run')} style={styles.runButton}>
          {({pressed}) => (
            <>
              <View style={styles.runLip} />
              <View style={[styles.runFace, pressed && styles.runFacePressed]}>
                <Footprints color={colors.textOnPrimary} size={28} strokeWidth={2.4} />
              </View>
            </>
          )}
        </Pressable>
        {/* 탭이 아니라 행동 버튼이라 선택된 탭처럼 보이지 않게 회색으로 둔다 */}
        <AppText variant="label" color={colors.textMuted} style={styles.runLabel}>
          달리기
        </AppText>
      </View>
      {right.map(tab => (
        <TabItem key={tab.key} label={tab.label} icon={tab.icon} active={activeTab === tab.key} onPress={() => onChange(tab.key)} />
      ))}
    </View>
  );
}

function TabItem({label, icon: Icon, active, onPress}: {label: string; icon: LucideIcon; active: boolean; onPress: () => void}) {
  const tint = active ? colors.primaryInk : colors.textSubtle;

  return (
    <Pressable accessibilityRole="tab" accessibilityState={{selected: active}} onPress={onPress} style={styles.tab}>
      <View style={[styles.iconPill, active && styles.iconPillActive]}>
        <Icon color={tint} size={22} strokeWidth={active ? 2.3 : 1.9} />
      </View>
      <AppText variant="label" color={tint} style={styles.tabLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    shadowColor: '#0B3A33',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: -4},
    elevation: 12,
  },
  tab: {flex: 1, height: TAB_BAR_HEIGHT - spacing.sm, alignItems: 'center', justifyContent: 'center'},
  // Android는 배경 없던 뷰에 나중에 배경이 생기면 모서리가 각지게 그려질 수 있어 투명 배경을 항상 둔다
  iconPill: {width: 52, height: 30, borderRadius: 15, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center'},
  iconPillActive: {backgroundColor: colors.primarySoft},
  tabLabel: {marginTop: 2, fontSize: 11},
  runSlot: {flex: 1, alignItems: 'center'},
  runButton: {width: RUN_SIZE, height: RUN_SIZE + RUN_LIP, marginTop: -30},
  runLip: {
    position: 'absolute',
    top: RUN_LIP,
    width: RUN_SIZE,
    height: RUN_SIZE,
    borderRadius: RUN_SIZE / 2,
    backgroundColor: colors.primaryPressed,
    shadowColor: '#0B3A33',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 8,
  },
  runFace: {
    width: RUN_SIZE,
    height: RUN_SIZE,
    borderRadius: RUN_SIZE / 2,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 9,
  },
  runFacePressed: {transform: [{translateY: RUN_LIP - 1}]},
  runLabel: {marginTop: 2, fontSize: 11},
});
