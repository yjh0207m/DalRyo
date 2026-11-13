import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Check,
  ChevronLeft,
  Flag,
  Footprints,
  Search,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { AppText, Badge, Button, Card, IconButton } from '../../components/ui';
import { usePostAuthor } from '../../hooks/usePostAuthor';
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
import { socialError } from '../../services/social.service';
import { queueRun, uploadPendingRun } from '../../services/runOutbox.service';
import type { RunContext, RunSessionSnapshot } from '../../types/runSession';
import { TogetherTrack } from './TogetherTrack';
import { RunnerAvatar } from './RunnerAvatar';
import { RunningScreen } from '../run/RunningScreen';
import { CompletedRunScreen } from '../run/CompletedRunScreen';
import type { RunStartSnapshot } from '../../utils/runCompletion';
import type { RunDocument } from '../../types/run.types';
import type { RunResult } from '../../hooks/useRunSession';
import type { CharacterDocument } from '../../types/character.types';
import type { UserDocument } from '../../types/user.types';
import {
  calculateAveragePace,
  formatDuration,
  formatPace,
} from '../../utils/pace';
import { colors, fonts, spacing } from '../../theme';
type Props = {
  user: UserDocument;
  character: CharacterDocument;
  onBack: () => void;
  // 같이 달린 기록의 카드를 피드에 올린 뒤 호출된다
  onPosted?: () => void;
  // 친구 프로필에서 '같이 달리기 요청'으로 들어오면 그 친구를 미리 골라 둔다
  initialFriendUid?: string;
  restore?: RunSessionSnapshot;
};
export function TogetherScreen({
  user,
  character,
  onBack,
  onPosted,
  initialFriendUid,
  restore,
}: Props) {
  const [roomId, setRoomId] = useState<string | null>(restore?.context.roomId ?? null);
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
  const [running, setRunning] = useState(!!restore);
  const [result, setResult] = useState<RunResult | null>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [savedRun, setSavedRun] = useState<RunDocument|null>(null);
  const sessionContext = useRef<RunContext | null>(restore?.context ?? null);
  const startSnapshot = useRef<RunStartSnapshot>(restore?.context.before ?? {stageBefore: character.stage, totalKmBefore:user.total_km,wasFrozen:user.is_frozen});
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
          setSelected(chosen =>
            chosen.filter(uid =>
              friendList.friends.some(friend => friend.uid === uid),
            ),
          );
          setInvites(inviteList.invites);
          if (current && !restore) setRoomId(current);
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
  }, [revision, restore]);
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
  const visibleMembers = members.filter(member => member.state !== 'left');
  const activeGoal = sessionContext.current?.goal.goalValue ?? null;
  const friendsRunning = room?.status === 'running' && visibleMembers.some(
    member => member.uid !== user.uid && (member.state === 'active' || member.state === 'paused'),
  );
  const reachedGoal = !!result && !!activeGoal && result.distanceKm >= activeGoal;
  const keepTrack = !!activeGoal && (reachedGoal || friendsRunning);
  useEffect(() => {
    if (running || (result && (showRecord || !keepTrack))) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back, running, result, keepTrack, showRecord]);
  const save = async (value: RunResult) => {
    if (operation.current || !roomId) return;
    operation.current = true;
    setBusy(true);
    setRunning(false);
    setResult(value);
    setError(null);
    try {
      if (!sessionContext.current) throw new Error('시작 기록을 찾지 못했어요.');
      const id = await queueRun(sessionContext.current, value);
      const run = await uploadPendingRun(user.uid, id);
      if (mounted.current) setSavedRun(run);
    } catch (e) {
      if (mounted.current) setError(socialError(e));
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (result) {
    if (savedRun && (showRecord || !keepTrack)) {
      return (
        <CompletedRunScreen
          run={savedRun}
          before={startSnapshot.current}
          character={character}
          onPosted={onPosted}
          onClose={() => {
            setShowRecord(false);
            if (!friendsRunning) {
              if (restore) {
                onBack();
                return;
              }
              setResult(null);
              setSavedRun(null);
            }
          }}
        />
      );
    }
    if (activeGoal && keepTrack) {
      const average = calculateAveragePace(result.durationSec, result.distanceKm);
      return (
        <SafeAreaView style={styles.spectator}>
          <StatusBar barStyle="dark-content" backgroundColor={colors.sky} />
          <View style={styles.spectatorHeader}>
            <IconButton icon={ChevronLeft} variant="plain" accessibilityLabel="뒤로" disabled={busy} onPress={back} />
            <AppText variant="subheading">같이 달리기</AppText>
          </View>
          <Card style={styles.gap}>
            <AppText variant="subheading" color={colors.primaryInk}>
              {reachedGoal ? '완주했어요!' : '내 달리기를 마쳤어요'}
            </AppText>
            <AppText variant="heading">{result.distanceKm.toFixed(2)} km</AppText>
            <View style={styles.spectatorStats}>
              {[
                ['시간', formatDuration(result.durationSec)],
                ['현재 페이스', '—'],
                ['평균 페이스', average ? formatPace(average) : '—'],
                ['칼로리', String(result.calories)],
              ].map(([label, value]) => (
                <View key={label} style={styles.spectatorStat}>
                  <AppText variant="caption" align="center" color={colors.textMuted}>{label}</AppText>
                  <AppText variant="subheading" align="center">{value}</AppText>
                </View>
              ))}
            </View>
          </Card>
          <TogetherTrack members={visibleMembers} uid={user.uid} ownProfile={user} character={character}
            goalKm={activeGoal} syncError={status === 'error'}
            own={{ current_km: result.distanceKm, pace_sec: average, state: 'finished' }} />
          <AppText variant="caption" align="center" color={colors.textMuted}>
            {friendsRunning ? '친구의 달리기를 보고 있어요' : room ? '같이 달리기가 끝났어요' : '방 상태를 확인하고 있어요'}
          </AppText>
          {error && <AppText variant="caption" color={colors.danger}>{error}</AppText>}
          <Button
            label={busy ? '기록 저장 중…' : savedRun ? '내 기록 보기' : '다시 저장'}
            disabled={busy}
            onPress={() => savedRun ? setShowRecord(true) : save(result)}
          />
        </SafeAreaView>
      );
    }
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
            <Button label="기기에 보관하고 나가기" variant="ghost" onPress={onBack}/>
          </>
        )}
      </SafeAreaView>
    );
  }
  if (running && sessionContext.current && activeGoal)
    return (
      <RunningScreen
        context={sessionContext.current}
        restore={restore}
        goalType="distance"
        goalValue={activeGoal}
        characterType={character.character_type}
        characterStage={startSnapshot.current.stageBefore}
        equipped={character.equipped}
        weightKg={user.weight_kg}
        onFinish={save}
        cancelMessage="그만두면 기록이 저장되지 않고 같이 달리기 방에서도 나가요."
        onCancel={() => {
          setRunning(false);
          action('leave');
          if (restore) onBack();
        }}
        onProgress={progress}
        finishAtGoal
        contextLabel="같이 달리기"
        renderTrack={({ km, pace, running: moving }) => (
          <TogetherTrack members={visibleMembers} uid={user.uid} ownProfile={user} character={character}
            goalKm={activeGoal} syncError={syncError || status === 'error'}
            own={{ current_km: km, pace_sec: pace, state: moving ? 'active' : 'paused' }} />
        )}
      />
    );
  const me = visibleMembers.find(member => member.uid === user.uid);
  const friendById = new Map(friends.map(friend => [friend.uid, friend]));
  const waiting = room?.status === 'waiting';
  const host = room?.host_uid === user.uid;
  const pending = room?.invited ?? [];
  const inviteLimit = room ? Math.max(0, 20 - room.capacity) : 19;
  const available = friends.filter(
    friend =>
      !members.some(member => member.uid === friend.uid) &&
      !pending.includes(friend.uid),
  );
  const goalKm = Number(goal.trim().replace(',', '.'));
  const validGoal = goalKm >= 0.1 && goalKm <= 100;
  const requestLabel = selected.length
    ? `${selected.length}명에게 요청 보내기`
    : '같이 달릴 친구를 골라 주세요';
  let footer: React.ReactNode;

  if (room && waiting && host && !picking) {
    footer = (
      <Button
        label="함께 달리기 시작"
        icon={Footprints}
        disabled={busy}
        onPress={() => action('start')}
      />
    );
  } else if (room?.status === 'running' && me && me.state !== 'finished') {
    footer = (
      <Button
        label="달리기 참여"
        icon={Footprints}
        disabled={busy}
        onPress={() => {
          startSnapshot.current = {
            stageBefore: character.stage,
            totalKmBefore: user.total_km,
            wasFrozen: user.is_frozen,
          };
          sessionContext.current = {
            uid: user.uid,
            sessionKey: `${user.uid}_${Date.now()}`,
            goal: { goalType: 'distance', goalValue: room.goal_km },
            before: startSnapshot.current,
            weightKg: user.weight_kg,
            roomId: room.room_id,
          };
          setRunning(true);
        }}
      />
    );
  } else if (!roomId && status === 'success' && friends.length > 0) {
    footer = (
      <Button
        label={requestLabel}
        icon={UserPlus}
        disabled={busy || !selected.length || !title.trim() || !validGoal}
        onPress={() =>
          action('create', {
            roomId: createId.current,
            title,
            goalKm,
            inviteUids: selected,
          })
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <View style={styles.header}>
        <IconButton
          icon={ChevronLeft}
          variant="plain"
          accessibilityLabel="같이 달리기에서 뒤로"
          disabled={busy}
          onPress={back}
        />
        <View style={styles.grow} />
        {room && (
          <Button
            label="나가기"
            size="md"
            variant="ghost"
            disabled={busy}
            onPress={leave}
          />
        )}
      </View>
      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {room ? (
            <View style={styles.hero}>
              <TrackMark />
              <View style={styles.heroTop}>
                <Badge
                  label={ROOM_STATUS[room.status]}
                  tone={waiting ? 'warm' : 'onSoft'}
                />
              </View>
              <AppText variant="title" style={styles.heroTitle}>
                {room.title}
              </AppText>
              <View style={styles.heroBottom}>
                <View style={styles.metric}>
                  <Flag size={16} color={colors.primaryInk} />
                  <AppText variant="caption" color={colors.primaryInk}>
                    목표
                  </AppText>
                  <AppText variant="heading" color={colors.primaryInk}>
                    {room.goal_km} km
                  </AppText>
                </View>
                <View style={styles.metric}>
                  <Users size={16} color={colors.textMuted} />
                  <AppText variant="caption" color={colors.textMuted}>
                    {room.member_count}/{room.capacity}명 참가
                  </AppText>
                </View>
              </View>
            </View>
          ) : (
            !roomId && (
              <View style={styles.hero}>
                <TrackMark />
                <AppText variant="title" style={styles.heroTitle}>
                  같이 달리기
                </AppText>
                <AppText color={colors.textMuted}>
                  목표 거리를 정하고, 친구와 서로의 달리기를 함께 보세요.
                </AppText>
              </View>
            )
          )}

          {!!error && (
            <AppText
              color={colors.danger}
              accessibilityRole="alert"
              style={styles.feedback}
            >
              {error}
            </AppText>
          )}
          {status === 'loading' && (
            <ActivityIndicator color={colors.primaryAction} />
          )}
          {status === 'error' && (
            <Button
              label="다시 불러오기"
              variant="secondary"
              size="md"
              style={styles.feedback}
              onPress={() => setRevision(v => v + 1)}
            />
          )}

          {roomId ? (
            room ? (
              <>
                <View style={styles.section}>
                  <View style={styles.sectionHeading}>
                    <AppText variant="heading">
                      {waiting ? '참가자' : room.status === 'running' ? '실시간 거리 순위' : '참가 결과'}
                    </AppText>
                    <AppText variant="label" color={colors.textMuted}>
                      {visibleMembers.length}명
                    </AppText>
                  </View>
                  {visibleMembers.map((member, index) => {
                    const own = member.uid === user.uid;
                    const profile = own
                      ? user
                      : friendById.get(member.uid) ?? member;
                    const [label, tint] = memberStatus(member, waiting, room.goal_km);
                    return (
                      <RunnerRow
                        key={member.uid}
                        uri={profile.profile_image}
                        name={profile.display_name ?? member.display_name}
                        detail={
                          waiting
                            ? member.uid === room.host_uid
                              ? '방장'
                              : undefined
                            : `${member.current_km.toFixed(2)} km · ${
                                member.pace_sec
                                  ? `${formatPace(member.pace_sec)} /km`
                                  : '페이스 —'
                              }`
                        }
                        prefix={waiting ? undefined : String(index + 1)}
                        mine={own}
                        trailing={
                          <AppText variant="label" color={tint}>
                            {label}
                          </AppText>
                        }
                      />
                    );
                  })}
                  {waiting && !host && (
                    <AppText variant="caption" color={colors.textMuted}>
                      방장이 시작하면 달리기에 참여할 수 있어요.
                    </AppText>
                  )}
                </View>

                {waiting && pending.length > 0 && (
                  <View style={[styles.section, styles.pending]}>
                    <View style={styles.sectionHeading}>
                      <AppText variant="subheading" color={colors.accentInk}>
                        응답을 기다리는 친구
                      </AppText>
                      <AppText variant="label" color={colors.accentInk}>
                        {pending.length}명
                      </AppText>
                    </View>
                    {pending.map(uid => {
                      const friend = friendById.get(uid);
                      return (
                        <RunnerRow
                          key={uid}
                          uri={friend?.profile_image}
                          name={
                            friend?.display_name ??
                            room.invited_names?.[uid] ??
                            '친구'
                          }
                          trailing={
                            <AppText variant="label" color={colors.accentInk}>
                              대기 중
                            </AppText>
                          }
                        />
                      );
                    })}
                  </View>
                )}

                {waiting && host && (
                  <View style={styles.section}>
                    {picking ? (
                      <>
                        <View style={styles.sectionHeading}>
                          <AppText variant="heading">친구 더 부르기</AppText>
                          <Button
                            label="취소"
                            size="md"
                            variant="ghost"
                            disabled={busy}
                            onPress={() => {
                              setSelected([]);
                              setPicking(false);
                            }}
                          />
                        </View>
                        <FriendPicker
                          friends={available}
                          limit={inviteLimit}
                          selected={selected}
                          onChange={setSelected}
                          disabled={busy}
                        />
                        <Button
                          label={requestLabel}
                          size="md"
                          icon={UserPlus}
                          disabled={busy || !selected.length}
                          onPress={() =>
                            action('invite', { inviteUids: selected })
                          }
                        />
                      </>
                    ) : (
                      available.length > 0 &&
                      inviteLimit > 0 && (
                        <Button
                          label="친구 더 부르기"
                          size="md"
                          icon={UserPlus}
                          variant="secondary"
                          disabled={busy}
                          onPress={() => {
                            setSelected([]);
                            setPicking(true);
                          }}
                        />
                      )
                    )}
                  </View>
                )}
              </>
            ) : (
              status === 'success' && (
                <AppText style={styles.feedback}>방을 찾을 수 없어요.</AppText>
              )
            )
          ) : (
            <>
              {invites.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeading}>
                    <AppText variant="heading">받은 요청</AppText>
                    <Badge label={`${invites.length}개`} tone="warm" />
                  </View>
                  {invites.map(invite => (
                    <InviteRow
                      key={invite.room_id}
                      invite={invite}
                      friend={friendById.get(invite.host_uid)}
                      disabled={busy}
                      onJoin={() => action('join', { roomId: invite.room_id })}
                      onDecline={() =>
                        action('decline', { roomId: invite.room_id })
                      }
                    />
                  ))}
                </View>
              )}

              {friends.length > 0 && (
                <View style={[styles.section, styles.setupSection]}>
                  <AppText variant="heading">러닝 설정</AppText>
                  <View style={styles.row}>
                    <View style={styles.grow}>
                      <AppText variant="label" color={colors.textMuted}>
                        방 이름
                      </AppText>
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
                      <AppText variant="label" color={colors.textMuted}>
                        목표 거리
                      </AppText>
                      <View style={styles.distanceInput}>
                        <TextInput
                          accessibilityLabel="목표 거리"
                          value={goal}
                          onChangeText={setGoal}
                          keyboardType="decimal-pad"
                          style={styles.distanceValue}
                          editable={!busy}
                        />
                        <AppText variant="caption" color={colors.textMuted}>
                          km
                        </AppText>
                      </View>
                    </View>
                  </View>
                  {!validGoal && (
                    <AppText variant="caption" color={colors.textMuted}>
                      목표는 0.1~100 km로 입력해 주세요.
                    </AppText>
                  )}
                </View>
              )}
              {status === 'success' && (
                <View style={styles.section}>
                  <View style={styles.sectionHeading}>
                    <AppText variant="heading">같이 달릴 친구</AppText>
                    {selected.length > 0 && (
                      <AppText variant="label" color={colors.primaryInk}>
                        {selected.length}명 선택
                      </AppText>
                    )}
                  </View>
                  {friends.length === 0 ? (
                    <View style={styles.emptyFriends}>
                      <Users size={24} color={colors.primaryInk} />
                      <AppText color={colors.textMuted} style={styles.grow}>
                        서로 팔로우한 친구에게 같이 달리기 요청을 보낼 수
                        있어요.
                      </AppText>
                    </View>
                  ) : (
                    <FriendPicker
                      friends={friends}
                      selected={selected}
                      onChange={setSelected}
                      disabled={busy}
                    />
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
        {!!footer && (
          <View style={styles.footer}>
            {!roomId && selected.length > 0 && (
              <SelectedFriends friends={friends} selected={selected} />
            )}
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ROOM_STATUS = {
  waiting: '출발 대기',
  running: '달리는 중',
  finished: '러닝 종료',
  cancelled: '취소된 방',
} as const;

function memberStatus(member: RoomMember, waiting: boolean, goalKm: number) {
  if (waiting) return ['참가 완료', colors.primaryInk] as const;
  if (member.state === 'finished')
    return [member.current_km >= goalKm ? '완주' : '기록 종료', colors.primaryInk] as const;
  if (member.state === 'paused') return ['일시정지', colors.accentInk] as const;
  return ['달리는 중', colors.primaryInk] as const;
}

function TrackMark() {
  return (
    <View style={styles.trackMark} pointerEvents="none">
      {[0, 1, 2].map(lane => (
        <View
          key={lane}
          style={[
            styles.trackRing,
            {
              top: lane * 15,
              left: lane * 15,
              right: lane * 15,
              bottom: lane * 15,
            },
          ]}
        />
      ))}
    </View>
  );
}

function SelectedFriends({
  friends,
  selected,
}: {
  friends: RoomFriend[];
  selected: string[];
}) {
  const people = friends.filter(friend => selected.includes(friend.uid));
  if (!people.length) return null;
  const shown = people.slice(0, 3);
  const remaining = people.length - shown.length;
  return (
    <View style={styles.selectedSummary}>
      <View
        style={styles.selectedAvatars}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {shown.map(friend => (
          <RunnerAvatar key={friend.uid} uri={friend.profile_image} size={28} />
        ))}
      </View>
      <AppText
        variant="caption"
        style={styles.grow}
        numberOfLines={2}
        accessibilityLabel={`초대할 친구 ${people
          .map(friend => friend.display_name)
          .join(', ')}`}
      >
        {shown.map(friend => friend.display_name).join(', ')}
        {remaining > 0 ? ` 외 ${remaining}명` : ''}
      </AppText>
    </View>
  );
}

function RunnerRow({
  uri,
  name,
  detail,
  prefix,
  mine,
  trailing,
}: {
  uri?: string | null;
  name: string;
  detail?: string;
  prefix?: string;
  mine?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.runnerRow}>
      {!!prefix && (
        <AppText variant="label" color={colors.textMuted} style={styles.rank}>
          {prefix}
        </AppText>
      )}
      <RunnerAvatar uri={uri} />
      <View style={styles.grow}>
        <AppText variant="subheading" numberOfLines={1}>
          {name}
          {mine ? ' (나)' : ''}
        </AppText>
        {!!detail && (
          <AppText variant="caption" color={colors.textMuted}>
            {detail}
          </AppText>
        )}
      </View>
      {trailing}
    </View>
  );
}

function InviteRow({
  invite,
  friend,
  disabled,
  onJoin,
  onDecline,
}: {
  invite: RoomInvite;
  friend?: RoomFriend;
  disabled: boolean;
  onJoin: () => void;
  onDecline: () => void;
}) {
  const profile = usePostAuthor(friend ? undefined : invite.host_uid) ?? friend;
  return (
    <View style={styles.invite}>
      <RunnerRow
        uri={profile?.profile_image}
        name={profile?.display_name ?? invite.host_name}
        detail={`${invite.title} · ${invite.goal_km} km · ${invite.member_count}명 참가`}
      />
      <View style={styles.inviteActions}>
        <Button
          label="거절"
          size="md"
          variant="ghost"
          disabled={disabled}
          onPress={onDecline}
        />
        <Button
          label="참가하기"
          size="md"
          variant="secondary"
          disabled={disabled}
          onPress={onJoin}
        />
      </View>
    </View>
  );
}

function FriendPicker({
  friends,
  selected,
  onChange,
  disabled,
  limit = 19,
}: {
  friends: RoomFriend[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  limit?: number;
}) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('ko-KR');
  const matches = friends.filter(friend =>
    friend.display_name.toLocaleLowerCase('ko-KR').includes(normalized),
  );
  if (!friends.length)
    return (
      <AppText color={colors.textMuted}>더 부를 수 있는 친구가 없어요.</AppText>
    );
  return (
    <View>
      <View style={styles.search}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="친구 닉네임 검색"
          accessibilityLabel="친구 닉네임 검색"
          placeholderTextColor={colors.textSubtle}
          maxLength={20}
          style={styles.searchInput}
          editable={!disabled}
        />
      </View>
      {!matches.length && (
        <AppText style={styles.noMatches} color={colors.textMuted}>
          검색한 친구가 없어요.
        </AppText>
      )}
      {matches.map(friend => {
        const checked = selected.includes(friend.uid);
        const unavailable = disabled || (!checked && selected.length >= limit);
        return (
          <Pressable
            key={friend.uid}
            accessibilityRole="checkbox"
            accessibilityLabel={friend.display_name}
            accessibilityState={{ checked, disabled: unavailable }}
            disabled={unavailable}
            onPress={() =>
              onChange(
                checked
                  ? selected.filter(id => id !== friend.uid)
                  : [...selected, friend.uid],
              )
            }
            style={({ pressed }) => [
              styles.friend,
              (pressed || checked) && styles.friendSelected,
            ]}
          >
            <RunnerRow
              uri={friend.profile_image}
              name={friend.display_name}
              trailing={
                <View style={[styles.check, checked && styles.checkOn]}>
                  {checked && (
                    <Check
                      color={colors.textOnPrimary}
                      size={14}
                      strokeWidth={3}
                    />
                  )}
                </View>
              }
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    gap: spacing.xs,
  },
  content: { gap: spacing.xxl, paddingBottom: spacing.xxl },
  feedback: { marginHorizontal: spacing.xl },
  hero: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  heroTop: { alignItems: 'flex-start' },
  heroTitle: { fontSize: 32, lineHeight: 40 },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackMark: {
    position: 'absolute',
    width: 215,
    height: 132,
    top: -22,
    right: -75,
    transform: [{ rotate: '-25deg' }],
  },
  trackRing: {
    position: 'absolute',
    borderRadius: 70,
    borderWidth: 2,
    borderColor: colors.primaryBorder,
  },
  section: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  setupSection: { gap: spacing.md },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selectedAvatars: { flexDirection: 'row', gap: spacing.xs },
  input: {
    minHeight: 48,
    marginTop: spacing.xs,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
  goal: { width: 104 },
  distanceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginTop: spacing.xs,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  distanceValue: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingVertical: 8,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  noMatches: { paddingVertical: spacing.md },
  emptyFriends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  friend: {
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: 12,
  },
  friendSelected: { backgroundColor: colors.background },
  runnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 60,
  },
  rank: { minWidth: 18, textAlign: 'center' },
  invite: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  inviteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: colors.primaryAction,
    borderColor: colors.primaryAction,
  },
  gap: { gap: 10 },
  pending: { backgroundColor: colors.accentSoft, paddingVertical: spacing.lg },

  spectator: {
    flex: 1,
    backgroundColor: colors.sky,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  spectatorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spectatorStats: { flexDirection: 'row', gap: 4 },
  spectatorStat: { flex: 1, gap: 4 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 28,
    gap: 20,
    justifyContent: 'center',
  },
});
