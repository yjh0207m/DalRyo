import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { CharacterView } from '../../components/character/CharacterView';
import { AppText } from '../../components/ui';
import type { RoomMember } from '../../services/room.service';
import {
  socialRequest,
  type RunnerProfile,
} from '../../services/social.service';
import { colors } from '../../theme';
import {
  CHARACTER_STAGE_ORDER,
  CHARACTER_TYPES,
  type CharacterDocument,
} from '../../types/character.types';
import { formatPace } from '../../utils/pace';

type Props = {
  members: RoomMember[];
  uid: string;
  character: CharacterDocument;
  goalKm: number;
  own: Pick<RoomMember, 'current_km' | 'pace_sec' | 'state'>;
  syncError: boolean;
};

export function TogetherTrack({
  members,
  uid,
  character,
  goalKm,
  own,
  syncError,
}: Props) {
  const peers = members.filter(member => member.uid !== uid);
  return (
    <View style={styles.track}>
      <View style={styles.heading}>
        <AppText variant="subheading">같이 달리기 트랙</AppText>
        <AppText variant="caption" color={colors.primaryInk}>
          목표 {goalKm.toFixed(2)} km
        </AppText>
      </View>
      {syncError && (
        <AppText variant="caption" color={colors.danger}>
          진행 상황을 갱신하지 못했어요.
        </AppText>
      )}
      <ScrollView style={styles.lanes} nestedScrollEnabled>
        <TrackLane name="나" progress={own} goalKm={goalKm} pet={character} />
        {peers.map(member => (
          <PeerLane key={member.uid} member={member} goalKm={goalKm} />
        ))}
      </ScrollView>
    </View>
  );
}

function PeerLane({ member, goalKm }: { member: RoomMember; goalKm: number }) {
  const [pet, setPet] = useState<RunnerProfile['pet']>();
  useEffect(() => {
    let live = true;
    socialRequest<RunnerProfile>('profile', { uid: member.uid })
      .then(profile => {
        if (live) setPet(profile.pet);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [member.uid]);
  return (
    <TrackLane
      name={member.display_name}
      progress={member}
      goalKm={goalKm}
      pet={pet}
    />
  );
}

function TrackLane({
  name,
  progress,
  goalKm,
  pet,
}: {
  name: string;
  progress: Props['own'];
  goalKm: number;
  pet?:
    | Pick<
        CharacterDocument,
        'character_type' | 'stage' | 'pet_name' | 'equipped'
      >
    | RunnerProfile['pet'];
}) {
  const [width, setWidth] = useState(0);
  const position = useRef(new Animated.Value(0)).current;
  const ratio = Math.min(1, Math.max(0, progress.current_km / goalKm));
  const running = progress.state === 'active';
  const finished = progress.state === 'finished';
  const status = finished
    ? ratio >= 1
      ? '완주'
      : '기록 종료'
    : running
    ? '달리는 중'
    : '잠깐 쉬는 중';
  useEffect(() => {
    const animation = Animated.timing(position, {
      toValue: Math.max(0, width - 64) * ratio,
      duration: 450,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [position, ratio, width]);
  const hasPet =
    pet &&
    CHARACTER_TYPES.includes(pet.character_type) &&
    CHARACTER_STAGE_ORDER.includes(pet.stage);
  return (
    <View style={styles.lane}>
      <View
        style={styles.rail}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.finishLine} pointerEvents="none">
          {Array.from({ length: 8 }, (_, i) => (
            <View
              key={i}
              style={[styles.checker, i % 3 === 0 && styles.darkChecker]}
            />
          ))}
        </View>
        <Animated.View
          style={[styles.runner, { transform: [{ translateX: position }] }]}
        >
          {hasPet ? (
            <CharacterView
              type={pet.character_type}
              stage={pet.stage}
              equipped={'equipped' in pet ? pet.equipped : undefined}
              size={60}
              motion={running ? 'run' : 'idle'}
            />
          ) : (
            <UserRound size={24} color={colors.primaryInk} />
          )}
        </Animated.View>
      </View>
      <View style={styles.info}>
        <AppText variant="caption" numberOfLines={1} style={styles.name}>
          {name} · {status}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {progress.current_km.toFixed(2)} km ·{' '}
          {progress.pace_sec ? formatPace(progress.pace_sec) + ' /km' : '—'}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.track,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    gap: 8,
  },
  lanes: { flex: 1 },
  lane: { backgroundColor: colors.surface },
  rail: {
    height: 62,
    backgroundColor: colors.primaryBorder,
    borderBottomWidth: 2,
    borderBottomColor: colors.trackLine,
    paddingRight: 12,
  },
  finishLine: {
    position: 'absolute',
    right: 29,
    top: 0,
    bottom: 0,
    width: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checker: { width: 6, height: '25%', backgroundColor: colors.surface },
  darkChecker: { backgroundColor: colors.primaryInk },
  runner: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  name: { flex: 1 },
});
