import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import {
  ITEM_CATALOG,
  type InventoryState,
  type ItemDefinition,
  type ItemSlot,
} from '../../../functions/src/itemCatalog';
import { CompanionScene } from '../../components/scene/CompanionScene';
import { CharacterView } from '../../components/character/CharacterView';
import { AppText, Button, Card, IconButton } from '../../components/ui';
import { inventoryRequest } from '../../services/inventory.service';
import { colors, radius, spacing } from '../../theme';
import type { CharacterDocument } from '../../types/character.types';

type Props = {
  character: CharacterDocument;
  frozen?: boolean;
  initialMode?: 'owned' | 'all';
  onBack: () => void;
};
export function InventoryScreen({
  character,
  frozen = false,
  initialMode = 'owned',
  onBack,
}: Props) {
  const [state, setState] = useState<InventoryState | null>(null);
  const [mode, setMode] = useState(initialMode);
  const [selected, setSelected] = useState<ItemDefinition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  const backRef = useRef(onBack);
  backRef.current = onBack;

  async function request(
    action: 'list' | 'equip' | 'unequip',
    input: { itemId?: string; slot?: ItemSlot } = {},
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await inventoryRequest(action, input);
      if (alive.current) {
        setState(result);
        if (action !== 'list') {
          setSelected(null);
          setNotice(
            action === 'equip'
              ? '장착했어요. 홈과 달리기에도 적용돼요.'
              : '장착을 해제했어요.',
          );
        }
      }
    } catch {
      if (alive.current)
        setError(
          '아이템을 저장하거나 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    request('list');
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!lock.current) backRef.current();
      return true;
    });
    return () => {
      alive.current = false;
      listener.remove();
    };
    // Open once per account/screen mount; profile snapshots must not reset previews.
  }, []);

  const equipped = state?.equipped ?? character.equipped ?? {};
  const owned = new Set(state?.owned ?? []);
  const preview = selected
    ? { ...equipped, [selected.slot]: selected.id }
    : equipped;
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <IconButton
          icon={ChevronLeft}
          variant="plain"
          accessibilityLabel="뒤로"
          onPress={() => {
            if (!lock.current) onBack();
          }}
        />
        <AppText variant="heading">꾸미기 · 아이템</AppText>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.preview} padded={false}>
          <CompanionScene height={220}>
            <CharacterView
              type={character.character_type}
              stage={character.stage}
              motion={frozen ? 'stone' : 'idle'}
              size={175}
              equipped={preview}
            />
          </CompanionScene>
          <View style={styles.previewCaption}>
            <AppText variant="subheading">{character.pet_name}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {selected
                ? `${selected.name} 미리보기 · 아직 저장되지 않았어요`
                : '현재 장착 모습'}
            </AppText>
          </View>
        </Card>
        {busy && (
          <ActivityIndicator
            accessibilityLabel="아이템 처리 중"
            color={colors.primary}
          />
        )}
        {!!error && (
          <Card>
            <AppText accessibilityRole="alert">{error}</AppText>
            <Button
              label="다시 불러오기"
              variant="ghost"
              onPress={() => request('list')}
              disabled={busy}
            />
          </Card>
        )}
        {!!notice && (
          <AppText accessibilityRole="alert" color={colors.primaryInk}>
            {notice}
          </AppText>
        )}
        {state && (
          <>
            <View style={styles.row}>
              <Button
                label={`보유 ${owned.size}개`}
                variant={mode === 'owned' ? 'primary' : 'secondary'}
                size="md"
                onPress={() => setMode('owned')}
                style={styles.flex}
              />
              <Button
                label="전체 아이템"
                variant={mode === 'all' ? 'primary' : 'secondary'}
                size="md"
                onPress={() => setMode('all')}
                style={styles.flex}
              />
            </View>
            <AppText variant="caption" color={colors.textMuted}>
              기본 아이템은 무료예요. 거리 보상은 누적 달리기 기록으로 열려요.
            </AppText>
            {(['back', 'accessory'] as const).map(slot => (
              <View key={slot} style={styles.section}>
                <View style={styles.row}>
                  <AppText variant="subheading" style={styles.flex}>
                    {slot === 'back' ? '배경빛' : '응원 소품'}
                  </AppText>
                  <Button
                    label={slot === 'back' ? '배경빛 해제' : '소품 해제'}
                    variant="ghost"
                    size="md"
                    disabled={busy || !equipped[slot]}
                    onPress={() => request('unequip', { slot })}
                  />
                </View>
                {ITEM_CATALOG.filter(
                  item =>
                    item.slot === slot &&
                    (mode === 'all' || owned.has(item.id)),
                ).map(item => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} 미리보기`}
                    accessibilityState={{
                      selected: selected?.id === item.id,
                      disabled: busy,
                    }}
                    disabled={busy}
                    onPress={() => {
                      setSelected(item);
                      setNotice('');
                    }}
                  >
                    <Card
                      style={[
                        styles.item,
                        selected?.id === item.id && styles.selected,
                      ]}
                    >
                      <View
                        style={[styles.swatch, { backgroundColor: item.color }]}
                      />
                      <View style={styles.flex}>
                        <AppText variant="subheading">
                          {item.name}
                          {equipped[item.slot] === item.id ? ' · 장착 중' : ''}
                        </AppText>
                        <AppText variant="caption" color={colors.textMuted}>
                          {item.description}
                        </AppText>
                        {!owned.has(item.id) && (
                          <AppText variant="caption" color={colors.textMuted}>
                            누적 {item.unlockKm}km 보상 ·{' '}
                            {Math.max(0, item.unlockKm - state.totalKm).toFixed(
                              1,
                            )}
                            km 남음
                          </AppText>
                        )}
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            ))}
            {selected && (
              <View style={styles.section}>
                <Button
                  label={
                    !owned.has(selected.id)
                      ? `누적 ${selected.unlockKm}km 달리면 받을 수 있어요`
                      : equipped[selected.slot] === selected.id
                      ? '이미 장착 중이에요'
                      : `${selected.name} 장착하기`
                  }
                  disabled={
                    busy ||
                    !owned.has(selected.id) ||
                    equipped[selected.slot] === selected.id
                  }
                  onPress={() => request('equip', { itemId: selected.id })}
                />
                <Button
                  label="미리보기 취소"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setSelected(null)}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  spacer: { width: 44 },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  preview: { overflow: 'hidden', borderRadius: radius.xl },
  previewCaption: { alignItems: 'center', padding: 16, gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.primary },
  swatch: { width: 32, height: 32, borderRadius: 16 },
});
