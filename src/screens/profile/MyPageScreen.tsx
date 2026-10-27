import React from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronLeft, ChevronRight, DoorOpen, Package, Shirt, SlidersHorizontal, type LucideIcon} from 'lucide-react-native';
import {CharacterView} from '../../components/character/CharacterView';
import {AppText, Card, IconButton} from '../../components/ui';
import {TAB_BAR_HEIGHT} from '../../navigation/BottomTabBar';
import {colors, radius, spacing} from '../../theme';
import type {CharacterDocument} from '../../types/character.types';
import type {UserDocument} from '../../types/user.types';

type Props = {
  user: UserDocument | null;
  character: CharacterDocument | null;
  onBack: () => void;
};

const MENU: Array<{icon: LucideIcon; title: string; detail: string}> = [
  {icon: Shirt, title: '꾸미기', detail: '옷을 입히고 꾸밀 수 있어요 · 준비 중'},
  {icon: DoorOpen, title: '마이룸', detail: '방 꾸미기와 친구 방문 · 준비 중'},
  {icon: Package, title: '아이템', detail: '성장 아이템과 보유함 · 준비 중'},
  {icon: SlidersHorizontal, title: '설정', detail: '프로필, 사투리, 알림, 로그아웃'},
];

// 헤더의 설정 버튼으로 들어오는 화면 (Figma: 마이 페이지 > 룸)
export function MyPageScreen({user, character, onBack}: Props) {
  const insets = useSafeAreaInsets();
  const frozen = user?.is_frozen ?? false;

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, {paddingTop: insets.top + spacing.sm, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + spacing.xxxl}]}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} variant="plain" accessibilityLabel="뒤로" onPress={onBack} />
        <AppText variant="heading">마이</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <Card style={styles.profile}>
        <View style={styles.avatar}>
          {character && (
            <CharacterView type={character.character_type} stage={character.stage} motion={frozen ? 'stone' : 'idle'} size={64} grounded={false} />
          )}
        </View>
        <View style={styles.profileText}>
          <AppText variant="heading">{user?.display_name ?? '달리너'}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {user?.region ?? '지역 미설정'} · 누적 {(user?.total_km ?? 0).toFixed(1)}km
          </AppText>
        </View>
      </Card>

      <Card style={styles.section} padded={false}>
        {MENU.map((item, index) => (
          <MenuRow key={item.title} {...item} last={index === MENU.length - 1} />
        ))}
      </Card>
    </ScrollView>
  );
}

function MenuRow({icon: Icon, title, detail, last}: {icon: LucideIcon; title: string; detail: string; last: boolean}) {
  return (
    <Pressable accessibilityRole="button" style={({pressed}) => [styles.menuRow, !last && styles.menuDivider, pressed && styles.menuPressed]}>
      <View style={styles.menuIcon}>
        <Icon color={colors.text} size={20} strokeWidth={1.9} />
      </View>
      <View style={styles.menuText}>
        <AppText variant="subheading">{title}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {detail}
        </AppText>
      </View>
      <ChevronRight color={colors.textSubtle} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  content: {paddingHorizontal: spacing.xl},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, marginHorizontal: -spacing.sm, marginBottom: spacing.lg},
  headerSpacer: {width: 44},
  profile: {flexDirection: 'row', alignItems: 'center', gap: spacing.lg},
  avatar: {width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center'},
  profileText: {flex: 1, gap: 2},
  section: {marginTop: spacing.md},
  menuRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg},
  menuDivider: {borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border},
  menuPressed: {backgroundColor: colors.surfaceMuted},
  menuIcon: {width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center'},
  menuText: {flex: 1, gap: 2},
});
