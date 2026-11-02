import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MessageSquare, UserRound } from 'lucide-react-native';
import { AppText, Button, IconButton } from '../../components/ui';
import { colors, spacing } from '../../theme';
import {
  myUid,
  socialError,
  socialRequest,
  type ConnectionPage,
  type PublicProfile,
} from '../../services/social.service';

export type ConnectionKind = 'followers' | 'following';
export function ConnectionsScreen({
  uid,
  initialKind = 'following',
  onBack,
  onProfile,
  onMessage,
  onKindChange,
}: {
  uid: string;
  initialKind?: ConnectionKind;
  onBack: () => void;
  onProfile: (uid: string) => void;
  onMessage: (uid: string) => void;
  onKindChange?: (kind: ConnectionKind) => void;
}) {
  const [kind, setKind] = useState(initialKind);
  const [users, setUsers] = useState<PublicProfile[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moreBusy, setMoreBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const serial = useRef(0);
  const paging = useRef(false);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => listener.remove();
  }, [onBack]);
  useEffect(() => {
    const request = ++serial.current;
    let live = true;
    paging.current = false;
    setUsers([]);
    setCursor(null);
    setLoading(true);
    setError('');
    setMoreBusy(false);
    socialRequest<ConnectionPage>('connections', { uid, kind })
      .then(page => {
        if (live) {
          setUsers(page.users);
          setCursor(page.cursor);
        }
      })
      .catch(e => {
        if (live) setError(socialError(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      if (serial.current === request) serial.current += 1;
    };
  }, [uid, kind, revision]);
  const loadMore = async () => {
    if (!cursor || paging.current) return;
    const request = serial.current;
    paging.current = true;
    setMoreBusy(true);
    setError('');
    try {
      const page = await socialRequest<ConnectionPage>('connections', {
        uid,
        kind,
        cursor,
      });
      if (serial.current !== request) return;
      setUsers(old => [
        ...new Map(
          [...old, ...page.users].map(person => [person.uid, person]),
        ).values(),
      ]);
      setCursor(page.cursor);
    } catch (e) {
      if (serial.current === request) setError(socialError(e));
    } finally {
      if (serial.current === request) {
        paging.current = false;
        setMoreBusy(false);
      }
    }
  };
  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel="관계 목록에서 뒤로"
          variant="plain"
          onPress={onBack}
        />
        <AppText variant="heading">
          {uid === myUid() ? '나의 러닝 친구' : '러닝 친구'}
        </AppText>
      </View>
      <View style={s.tabs}>
        {(
          [
            ['following', '팔로잉'],
            ['followers', '팔로워'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === value }}
            onPress={() => {
              setKind(value);
              onKindChange?.(value);
            }}
            style={[s.tab, kind === value && s.active]}
          >
            <AppText
              color={kind === value ? colors.primaryInk : colors.textMuted}
            >
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator style={s.loading} color={colors.primary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={person => person.uid}
          contentContainerStyle={s.list}
          renderItem={({ item: person }) => (
            <View style={s.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${person.display_name} 프로필 보기`}
                onPress={() => onProfile(person.uid)}
                style={s.person}
              >
                <View style={s.avatar}>
                  {person.profile_image ? (
                    <Image
                      source={{ uri: person.profile_image }}
                      style={s.image}
                    />
                  ) : (
                    <UserRound color={colors.primaryInk} size={23} />
                  )}
                </View>
                <View style={s.details}>
                  <AppText variant="subheading" numberOfLines={1}>
                    {person.display_name}
                  </AppText>
                  <AppText variant="caption" color={colors.textMuted}>
                    {person.region} · {person.total_km.toFixed(1)}km
                  </AppText>
                </View>
              </Pressable>
              {person.uid !== myUid() && (
                <IconButton
                  icon={MessageSquare}
                  variant="surface"
                  accessibilityLabel={`${person.display_name}에게 메시지 보내기`}
                  onPress={() => onMessage(person.uid)}
                />
              )}
            </View>
          )}
          ListEmptyComponent={
            !error ? (
              <View style={s.empty}>
                <UserRound size={34} color={colors.primary} />
                <AppText variant="subheading">
                  {kind === 'following'
                    ? '아직 팔로잉하는 러너가 없어요'
                    : '아직 팔로워가 없어요'}
                </AppText>
                <AppText color={colors.textMuted}>
                  함께 달릴 러너의 프로필에서 인사를 나눠 보세요.
                </AppText>
              </View>
            ) : null
          }
          ListFooterComponent={
            <View style={s.footer}>
              {!!error && (
                <>
                  <AppText accessibilityRole="alert" color={colors.danger}>
                    {error}
                  </AppText>
                  <Button
                    label="다시 시도"
                    size="md"
                    onPress={
                      users.length ? loadMore : () => setRevision(v => v + 1)
                    }
                  />
                </>
              )}
              {!!cursor && !error && (
                <Button
                  label={moreBusy ? '불러오는 중…' : '더 보기'}
                  variant="secondary"
                  disabled={moreBusy}
                  onPress={loadMore}
                />
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 5,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  tab: { flex: 1, padding: 13, alignItems: 'center', borderRadius: 14 },
  active: { backgroundColor: colors.primarySoft },
  list: { padding: 20, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  details: { flex: 1, gap: 4 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: 48, height: 48 },
  loading: { marginTop: 50 },
  empty: { paddingVertical: 50, gap: 14, alignItems: 'center' },
  footer: { gap: 12, paddingVertical: 12 },
});
