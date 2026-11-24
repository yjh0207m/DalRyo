import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { Check, UserRound } from 'lucide-react-native';
import { AppText, BottomSheet, Button } from '../../components/ui';
import {
  fetchFriends,
  socialError,
  type Friend,
} from '../../services/social.service';
import { colors, fonts, radius, spacing, themedStyles } from '../../theme';

// 함께 달린 사람으로 태그할 수 있는 인원. 서버도 같은 수로 막는다
export const MAX_RUNNER_TAGS = 10;
// 친구가 이보다 많으면 이름 찾기 칸을 보여 준다
const SEARCH_FROM = 8;

// 함께 달린 사람을 고르는 시트. 서로 팔로우하는 친구 중에서 여러 명을 고르고 "완료"로 정한다
export function RunnerTagSheet({
  selected,
  onDone,
  onClose,
}: {
  selected: Friend[];
  onDone: (runners: Friend[]) => void;
  onClose: () => void;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Friend[]>(selected);
  const [query, setQuery] = useState('');
  const load = useCallback(() => {
    let active = true;
    setStatus('loading');
    fetchFriends()
      .then(list => {
        if (!active) return;
        setFriends(list);
        setStatus('success');
      })
      .catch(failure => {
        if (!active) return;
        setError(socialError(failure));
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => load(), [load]);
  const isPicked = (uid: string) => picked.some(friend => friend.uid === uid);
  const toggle = (friend: Friend) =>
    setPicked(old =>
      old.some(item => item.uid === friend.uid)
        ? old.filter(item => item.uid !== friend.uid)
        : old.length >= MAX_RUNNER_TAGS
        ? old
        : [...old, friend],
    );
  const keyword = query.trim().toLowerCase();
  const shown = keyword
    ? friends.filter(friend =>
        friend.display_name.toLowerCase().includes(keyword),
      )
    : friends;
  return (
    <BottomSheet
      title="함께 달린 사람"
      testID="runner-tag-sheet"
      onClose={onClose}
      renderFooter={close => (
        <Button
          label={picked.length > 0 ? `${picked.length}명 태그하기` : '완료'}
          onPress={() => close(() => onDone(picked))}
        />
      )}
    >
      <AppText variant="caption" color={colors.textMuted} style={styles.hint}>
        {`서로 팔로우하는 친구를 ${MAX_RUNNER_TAGS}명까지 태그할 수 있어요.`}
      </AppText>
      {friends.length > SEARCH_FROM && (
        <TextInput
          accessibilityLabel="친구 이름 찾기"
          value={query}
          onChangeText={setQuery}
          placeholder="이름으로 찾기"
          placeholderTextColor={colors.textSubtle}
          autoCorrect={false}
          style={styles.search}
        />
      )}
      {status === 'loading' ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : status === 'error' ? (
        <View style={styles.message}>
          <AppText color={colors.danger} align="center">
            {error || '친구 목록을 불러오지 못했어요.'}
          </AppText>
          <Button
            label="다시 시도"
            size="md"
            variant="secondary"
            onPress={load}
          />
        </View>
      ) : friends.length === 0 ? (
        <AppText color={colors.textMuted} align="center" style={styles.message}>
          아직 서로 팔로우하는 친구가 없어요.
        </AppText>
      ) : shown.length === 0 ? (
        <AppText color={colors.textMuted} align="center" style={styles.message}>
          찾는 친구가 없어요.
        </AppText>
      ) : (
        shown.map(friend => {
          const on = isPicked(friend.uid);
          const full = !on && picked.length >= MAX_RUNNER_TAGS;
          return (
            <Pressable
              key={friend.uid}
              accessibilityRole="checkbox"
              accessibilityLabel={friend.display_name}
              accessibilityState={{ checked: on, disabled: full }}
              disabled={full}
              onPress={() => toggle(friend)}
              style={({ pressed }) => [
                styles.row,
                full && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {friend.profile_image ? (
                <Image
                  source={{ uri: friend.profile_image }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <UserRound size={20} color={colors.primaryInk} />
                </View>
              )}
              <AppText variant="body" numberOfLines={1} style={styles.name}>
                {friend.display_name}
              </AppText>
              <View style={[styles.check, on && styles.checkOn]}>
                {on && <Check size={16} color={colors.textOnPrimary} />}
              </View>
            </Pressable>
          );
        })
      )}
    </BottomSheet>
  );
}

const styles = themedStyles(() => ({
  hint: { marginBottom: spacing.md },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  loading: { marginVertical: spacing.xl },
  message: { marginVertical: spacing.lg, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarEmpty: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flex: 1 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
}));
