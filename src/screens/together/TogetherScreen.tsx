import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft, UserRound } from 'lucide-react-native';
import { AppText, Button, Card, IconButton } from '../../components/ui';
import {
  activeRoomId,
  newRoomId,
  publishRoomProgress,
  roomRequest,
  watchRoom,
  type RoomFriend,
  type RoomInvite,
  type RoomMember,
  type TogetherRoom,
} from '../../services/room.service';
import { myUid, socialError } from '../../services/social.service';
import { saveRunRecord } from '../../services/run.service';
import { RunningScreen } from '../run/RunningScreen';
import { RunCompleteScreen } from '../run/RunCompleteScreen';
import type { RunResult } from '../../hooks/useRunSession';
import type { CharacterDocument } from '../../types/character.types';
import type { UserDocument } from '../../types/user.types';
import { calculateAveragePace, formatPace } from '../../utils/pace';
import { colors, spacing } from '../../theme';
type Props = {
  user: UserDocument;
  character: CharacterDocument;
  onBack: () => void;
  // 친구 프로필에서 '같이 달리기 요청'으로 들어오면 그 친구를 미리 골라 둔다
  initialFriendUid?: string;
};
export function TogetherScreen({
  user,
  character,
  onBack,
  initialFriendUid,
}: Props) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<TogetherRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [friends, setFriends] = useState<RoomFriend[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [selected, setSelected] = useState<string[]>(
    initialFriendUid ? [initialFriendUid] : [],
  );
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [title, setTitle] = useState('같이 달료!');
  const [goal, setGoal] = useState('5');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [complete, setComplete] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const operation = useRef(false),
    publishing = useRef(false),
    createId = useRef(newRoomId());
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    let active = true;
    setStatus('loading');
    Promise.all([
      roomRequest<{ friends: RoomFriend[] }>('friends'),
      roomRequest<{ invites: RoomInvite[] }>('invites'),
      activeRoomId(),
    ])
      .then(([friendList, inviteList, current]) => {
        if (active) {
          setFriends(friendList.friends);
          setInvites(inviteList.invites);
          if (current) setRoomId(current);
          setStatus('success');
        }
      })
      .catch(e => {
        if (active) {
          setStatus('error');
          setError(socialError(e));
        }
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setMembers([]);
      return;
    }
    setStatus('loading');
    return watchRoom(
      roomId,
      r => {
        setRoom(r);
        setStatus('success');
      },
      setMembers,
      e => {
        setStatus('error');
        setError(socialError(e));
      },
    );
  }, [roomId, revision]);
  const progress = useCallback(
    async (km: number, pace: number, paused: boolean) => {
      if (!roomId || publishing.current) return;
      publishing.current = true;
      try {
        await publishRoomProgress(
          roomId,
          km,
          pace,
          paused ? 'paused' : 'active',
        );
        if (mounted.current) setSyncError(false);
      } catch {
        if (mounted.current) setSyncError(true);
      } finally {
        publishing.current = false;
      }
    },
    [roomId],
  );
  const action = async (name: string, input: Record<string, unknown> = {}) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const data = await roomRequest<{ roomId: string }>(name, {
        roomId,
        ...input,
      });
      if (!mounted.current) return;
      setSelected([]);
      setPicking(false);
      if (name === 'leave' || name === 'decline') {
        setRoomId(null);
        setRevision(v => v + 1);
        createId.current = newRoomId();
      } else setRoomId(data.roomId);
    } catch (e) {
      if (mounted.current) setError(socialError(e));
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const leave = () =>
    Alert.alert(
      '방에서 나갈까요?',
      '나가면 이 방의 실시간 비교에서 제외돼요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: () => action('leave'),
        },
      ],
    );
  const back = useCallback(() => {
    if (!operation.current) onBack();
  }, [onBack]);
  useEffect(() => {
    if (running || result) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back, running, result]);
  const save = async (value: RunResult) => {
    if (operation.current || !roomId) return;
    operation.current = true;
    setBusy(true);
    setRunning(false);
    setResult(value);
    setError(null);
    try {
      await saveRunRecord({
        goalType: 'distance',
        goalValue: room?.goal_km ?? null,
        startedAt: value.startedAt,
        durationSec: value.durationSec,
        distanceKm: value.distanceKm,
        avgSpeedKmh: value.avgSpeedKmh,
        calories: value.calories,
        route: value.route,
      });
      await roomRequest('finish', {
        roomId,
        km: value.distanceKm,
        pace: calculateAveragePace(value.durationSec, value.distanceKm),
      });
      if (mounted.current) setComplete(true);
    } catch (e) {
      if (mounted.current) setError(socialError(e));
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const visibleMembers = members.filter(m => m.state !== 'left');
  if (result) {
    if (complete)
      return (
        <RunCompleteScreen
          distanceKm={result.distanceKm}
          durationSec={result.durationSec}
          avgPaceSec={calculateAveragePace(
            result.durationSec,
            result.distanceKm,
          )}
          calories={result.calories}
          characterType={character.character_type}
          petName={character.pet_name}
          stageBeforeRun={character.stage}
          stageAfterRun={character.stage}
          wasFrozen={false}
          onViewRecord={() => {
            setResult(null);
            setComplete(false);
          }}
          onClose={() => {
            setResult(null);
            setComplete(false);
          }}
        />
      );
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <ActivityIndicator animating={busy} color={colors.primary} />
        <AppText variant="subheading">같이 달린 기록 저장</AppText>
        {error && (
          <>
            <AppText color={colors.danger}>{error}</AppText>
            <Button
              label="다시 저장"
              disabled={busy}
              onPress={() => save(result)}
            />
          </>
        )}
      </SafeAreaView>
    );
  }
  if (running && room)
    return (
      <RunningScreen
        goalType="distance"
        goalValue={room.goal_km}
        characterType={character.character_type}
        characterStage={character.stage}
        weightKg={user.weight_kg}
        onFinish={save}
        cancelMessage="그만두면 기록이 저장되지 않고 같이 달리기 방에서도 나가요."
        onCancel={() => {
          setRunning(false);
          action('leave');
        }}
        onProgress={progress}
        livePanel={
          <View style={styles.live}>
            <AppText variant="label">
              실시간 순위 ·{' '}
              {syncError ? '연결을 확인해 주세요' : '5초마다 갱신'}
            </AppText>
            {visibleMembers.slice(0, 3).map((m, i) => (
              <AppText key={m.uid} variant="caption">
                {i + 1}. {m.uid === user.uid ? '나' : m.display_name} ·{' '}
                {m.current_km.toFixed(2)} km ·{' '}
                {m.pace_sec ? formatPace(m.pace_sec) : '—'} /km
              </AppText>
            ))}
          </View>
        }
      />
    );
  const me = members.find(m => m.uid === myUid());
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <IconButton
          icon={ChevronLeft}
          variant="plain"
          accessibilityLabel="같이 달리기에서 뒤로"
          disabled={busy}
          onPress={back}
        />
        <AppText variant="heading">같이 달리기</AppText>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {error && <AppText color={colors.danger}>{error}</AppText>}
        {status === 'loading' && <ActivityIndicator color={colors.primary} />}
        {status === 'error' && (
          <Button
            label="다시 불러오기"
            variant="secondary"
            size="md"
            onPress={() => setRevision(v => v + 1)}
          />
        )}
        {roomId ? (
          <>
            {!room ? (
              status === 'success' && <AppText>방을 찾을 수 없어요.</AppText>
            ) : (
              <>
                <Card style={styles.gap}>
                  <AppText variant="heading">{room.title}</AppText>
                  <AppText>
                    {room.goal_km} km · {room.member_count}/{room.capacity}명 ·{' '}
                    {
                      {
                        waiting: '시작 대기',
                        running: '달리는 중',
                        finished: '종료',
                        cancelled: '취소',
                      }[room.status]
                    }
                  </AppText>
                </Card>
                <AppText variant="subheading">실시간 거리 순위</AppText>
                {visibleMembers.map((m, i) => (
                  <Card key={m.uid} style={styles.gap}>
                    <AppText variant="subheading">
                      {i + 1}. {m.uid === user.uid ? '나' : m.display_name}
                      {m.uid === room.host_uid ? ' · 방장' : ''}
                    </AppText>
                    <AppText>
                      {m.current_km.toFixed(2)} km ·{' '}
                      {m.pace_sec ? formatPace(m.pace_sec) : '—'} /km ·{' '}
                      {m.state === 'finished'
                        ? '완료'
                        : m.state === 'paused'
                        ? '일시정지'
                        : room.status === 'waiting'
                        ? '대기'
                        : '달리는 중'}
                    </AppText>
                  </Card>
                ))}
                {room.status === 'waiting' && !!room.invited?.length && (
                  <Card style={styles.gap}>
                    <AppText variant="label">응답 기다리는 중</AppText>
                    <AppText color={colors.textMuted}>
                      {room.invited
                        .map(f => room.invited_names?.[f] ?? '친구')
                        .join(', ')}
                    </AppText>
                  </Card>
                )}
                {room.status === 'waiting' &&
                  room.host_uid === user.uid &&
                  (picking ? (
                    <>
                      <FriendPicker
                        friends={friends.filter(
                          f =>
                            !members.some(m => m.uid === f.uid) &&
                            !room.invited?.includes(f.uid),
                        )}
                        selected={selected}
                        onChange={setSelected}
                        disabled={busy}
                      />
                      <Button
                        label={`${selected.length}명에게 요청 보내기`}
                        size="md"
                        disabled={busy || !selected.length}
                        onPress={() =>
                          action('invite', { inviteUids: selected })
                        }
                      />
                    </>
                  ) : (
                    <Button
                      label="친구 더 부르기"
                      size="md"
                      variant="secondary"
                      disabled={busy}
                      onPress={() => {
                        setSelected([]);
                        setPicking(true);
                      }}
                    />
                  ))}
                {room.status === 'waiting' && room.host_uid === user.uid && (
                  <Button
                    label="함께 달리기 시작"
                    disabled={busy}
                    onPress={() => action('start')}
                  />
                )}
                {room.status === 'waiting' && room.host_uid !== user.uid && (
                  <AppText>방장이 시작하면 달리기에 참여할 수 있어요.</AppText>
                )}
                {room.status === 'running' && me && me.state !== 'finished' && (
                  <Button
                    label="달리기 참여"
                    disabled={busy}
                    onPress={() => setRunning(true)}
                  />
                )}
                <Button
                  label="방 나가기"
                  size="md"
                  variant="secondary"
                  disabled={busy}
                  onPress={leave}
                />
              </>
            )}
          </>
        ) : (
          <>
            {invites.length > 0 && (
              <>
                <AppText variant="subheading">받은 요청</AppText>
                {invites.map(inv => (
                  <Card key={inv.room_id} style={styles.gap}>
                    <AppText variant="subheading">
                      {inv.host_name}님의 같이 달리기
                    </AppText>
                    <AppText color={colors.textMuted}>
                      {inv.title} · {inv.goal_km} km · {inv.member_count}명 참가
                    </AppText>
                    <View style={styles.row}>
                      <Button
                        label="거절"
                        size="md"
                        variant="secondary"
                        disabled={busy}
                        style={styles.grow}
                        onPress={() =>
                          action('decline', { roomId: inv.room_id })
                        }
                      />
                      <Button
                        label="같이 달리기"
                        size="md"
                        disabled={busy}
                        style={styles.grow}
                        onPress={() => action('join', { roomId: inv.room_id })}
                      />
                    </View>
                  </Card>
                ))}
              </>
            )}
            <AppText variant="subheading">친구에게 같이 달리기 요청</AppText>
            {status === 'success' && !friends.length ? (
              <AppText color={colors.textMuted}>
                서로 팔로우한 친구에게 요청할 수 있어요. 커뮤니티에서 러너를
                찾아 팔로우해 보세요.
              </AppText>
            ) : (
              <FriendPicker
                friends={friends}
                selected={selected}
                onChange={setSelected}
                disabled={busy}
              />
            )}
            {friends.length > 0 && (
              <>
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <AppText variant="caption">방 이름</AppText>
                    <TextInput
                      accessibilityLabel="방 이름"
                      value={title}
                      onChangeText={setTitle}
                      maxLength={40}
                      style={styles.input}
                      editable={!busy}
                    />
                  </View>
                  <View style={styles.goal}>
                    <AppText variant="caption">목표 (km)</AppText>
                    <TextInput
                      accessibilityLabel="목표 거리"
                      value={goal}
                      onChangeText={setGoal}
                      keyboardType="decimal-pad"
                      style={styles.input}
                      editable={!busy}
                    />
                  </View>
                </View>
                <Button
                  label={
                    selected.length
                      ? `${selected.length}명에게 요청 보내기`
                      : '같이 달릴 친구를 골라 주세요'
                  }
                  disabled={busy || !selected.length}
                  onPress={() =>
                    action('create', {
                      roomId: createId.current,
                      title,
                      goalKm: Number(goal),
                      inviteUids: selected,
                    })
                  }
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
function FriendPicker({
  friends,
  selected,
  onChange,
  disabled,
}: {
  friends: RoomFriend[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  if (!friends.length)
    return (
      <AppText color={colors.textMuted}>더 부를 수 있는 친구가 없어요.</AppText>
    );
  return (
    <Card style={styles.friends}>
      {friends.map(f => {
        const on = selected.includes(f.uid);
        return (
          <Pressable
            key={f.uid}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled }}
            accessibilityLabel={f.display_name}
            disabled={disabled}
            onPress={() =>
              onChange(
                on ? selected.filter(id => id !== f.uid) : [...selected, f.uid],
              )
            }
            style={styles.friend}
          >
            <View style={styles.avatar}>
              <UserRound color={colors.primaryInk} size={20} />
            </View>
            <AppText variant="subheading" style={styles.grow}>
              {f.display_name}
            </AppText>
            <View style={[styles.check, on && styles.checkOn]}>
              {on && <Check color={colors.surface} size={16} strokeWidth={3} />}
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    color: colors.text,
    fontFamily: 'Pretendard-Regular',
  },
  row: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1 },
  goal: { width: 110 },
  friends: { paddingVertical: 4, gap: 0 },
  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  gap: { gap: 10 },
  live: { padding: 12, gap: 4, backgroundColor: colors.primarySoft },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 28,
    gap: 20,
    justifyContent: 'center',
  },
});
