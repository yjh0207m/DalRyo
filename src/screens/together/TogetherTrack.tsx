import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { Flag } from 'lucide-react-native';
import { CharacterView } from '../../components/character/CharacterView';
import { AppText } from '../../components/ui';
import { RunnerAvatar } from './RunnerAvatar';
import type { RoomMember } from '../../services/room.service';
import {
  socialRequest,
  type RunnerProfile,
} from '../../services/social.service';
import { colors, fonts } from '../../theme';
import {
  CHARACTER_STAGE_ORDER,
  CHARACTER_TYPES,
  type CharacterDocument,
} from '../../types/character.types';
import { formatPace } from '../../utils/pace';

type Props = {
  members: RoomMember[];
  uid: string;
  ownProfile: Pick<RoomMember, 'display_name' | 'profile_image'>;
  character: CharacterDocument;
  goalKm: number;
  own: Pick<RoomMember, 'current_km' | 'pace_sec' | 'state'>;
  syncError: boolean;
};

export function TogetherTrack({
  members,
  uid,
  ownProfile,
  character,
  goalKm,
  own,
  syncError,
}: Props) {
  const peers = members.filter(member => member.uid !== uid);
  return (
    <View style={styles.track}>
      <View style={styles.heading}>
        <View style={styles.name}>
          <AppText
            variant="label"
            color={colors.primaryInk}
            style={styles.eyebrow}
          >
            LIVE TRACK
          </AppText>
          <AppText variant="subheading">같이 달리기 트랙</AppText>
        </View>
        <View style={styles.goal}>
          <Flag size={14} color={colors.primaryInk} />
          <AppText variant="label" color={colors.primaryInk}>
            목표 {goalKm} km
          </AppText>
        </View>
      </View>
      {syncError && (
        <AppText variant="caption" color={colors.danger} style={styles.notice}>
          진행 상황을 갱신하지 못했어요.
        </AppText>
      )}
      <ScrollView style={styles.lanes} nestedScrollEnabled>
        <TrackLane
          name={ownProfile.display_name || '나'}
          photo={ownProfile.profile_image}
          mine
          progress={own}
          goalKm={goalKm}
          pet={character}
        />
        {peers.map(member => (
          <PeerLane key={member.uid} member={member} goalKm={goalKm} />
        ))}
      </ScrollView>
    </View>
  );
}

function PeerLane({ member, goalKm }: { member: RoomMember; goalKm: number }) {
  const [runner, setRunner] = useState<RunnerProfile>();
  useEffect(() => {
    let live = true;
    socialRequest<RunnerProfile>('profile', { uid: member.uid })
      .then(profile => {
        if (live) setRunner(profile);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [member.uid]);
  return (
    <TrackLane
      name={runner?.profile?.display_name ?? member.display_name}
      photo={
        runner?.profile ? runner.profile.profile_image : member.profile_image
      }
      progress={member}
      goalKm={goalKm}
      pet={runner?.pet}
    />
  );
}

function TrackLane({
  name,
  photo,
  mine = false,
  progress,
  goalKm,
  pet,
}: {
  name: string;
  photo?: string | null;
  mine?: boolean;
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
    <View style={[styles.lane, mine && styles.ownLane]}>
      <View style={styles.info}>
        <RunnerAvatar uri={photo} size={30} />
        <View style={styles.name}>
          <AppText variant="subheading" numberOfLines={1}>
            {name}
            {mine && name !== '나' ? ' (나)' : ''}
          </AppText>
          <AppText
            variant="label"
            color={running || finished ? colors.primaryInk : colors.accentInk}
          >
            {status}
          </AppText>
        </View>
        <View style={styles.numbers}>
          <AppText variant="subheading" align="right" style={styles.distance}>
            {progress.current_km.toFixed(2)} km
          </AppText>
          <AppText variant="label" align="right" color={colors.textMuted}>
            {progress.pace_sec
              ? `${formatPace(progress.pace_sec)} /km`
              : '페이스 —'}
          </AppText>
        </View>
      </View>
      <View
        style={[styles.rail, mine && styles.ownRail]}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.railMarks} pointerEvents="none">
          {[0, 1, 2].map(mark => (
            <View key={mark} style={styles.railMark} />
          ))}
        </View>
        <View style={styles.finishLine} pointerEvents="none">
          {Array.from({ length: 8 }, (_, i) => (
            <View
              key={i}
              style={[
                styles.checker,
                [0, 3, 4, 7].includes(i) && styles.darkChecker,
              ]}
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
            <RunnerAvatar uri={photo} size={32} />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  eyebrow: { letterSpacing: 1.5, fontSize: 10 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  notice: { paddingHorizontal: 12, paddingBottom: 6 },
  lanes: { flex: 1 },
  lane: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: colors.surface,
  },
  ownLane: { backgroundColor: colors.background },
  rail: {
    height: 62,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    overflow: 'hidden',
  },
  ownRail: { backgroundColor: colors.track },
  railMarks: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 29,
    right: 31,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  railMark: { width: 1, backgroundColor: colors.trackLine },
  finishLine: {
    position: 'absolute',
    right: 23,
    top: 10,
    bottom: 10,
    width: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checker: { width: 5, height: '25%', backgroundColor: colors.surface },
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
    paddingVertical: 6,
    gap: 8,
  },
  name: { flex: 1 },
  numbers: { flexShrink: 0 },
  distance: { fontFamily: fonts.bold, fontVariant: ['tabular-nums'] },
});
