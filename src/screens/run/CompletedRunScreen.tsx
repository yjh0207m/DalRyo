import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import type { CharacterDocument } from '../../types/character.types';
import type { RunDocument } from '../../types/run.types';
import {
  runCompletion,
  type RunStartSnapshot,
} from '../../utils/runCompletion';
import { RunCompleteScreen } from './RunCompleteScreen';
import { RunDetailScreen } from './RunDetailScreen';
import { ShareStudioScreen } from './ShareStudioScreen';

// Both solo and group sessions keep the same saved record and start snapshot.
export function CompletedRunScreen({
  run,
  before,
  character,
  onClose,
  onRecordBack,
}: {
  run: RunDocument;
  before: RunStartSnapshot;
  character: CharacterDocument;
  onClose: () => void;
  onRecordBack?: () => void;
}) {
  const [page, setPage] = useState<'complete' | 'share' | 'detail'>('complete');
  useEffect(() => {
    if (page !== 'complete') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [page, onClose]);
  const growth = runCompletion(before, run);
  const shownCharacter = { ...character, stage: growth.stageAfter };
  return (
    <View style={styles.screen}>
      {/* Keep the reveal mounted so returning from sharing does not replay it. */}
      <View
        style={[styles.screen, page !== 'complete' && styles.hidden]}
        importantForAccessibility={
          page === 'complete' ? 'auto' : 'no-hide-descendants'
        }
        accessibilityElementsHidden={page !== 'complete'}
      >
        <RunCompleteScreen
          distanceKm={run.distance_km}
          durationSec={run.duration_sec}
          avgPaceSec={run.avg_pace_sec}
          calories={run.calories}
          route={run.route}
          characterType={character.character_type}
          equipped={character.equipped}
          petName={character.pet_name}
          stageBeforeRun={growth.stageBefore}
          stageAfterRun={growth.stageAfter}
          totalKmBefore={growth.totalKmBefore}
          wasFrozen={growth.wasFrozen}
          growthDistanceKm={growth.growthDistanceKm}
          onTakePhoto={() => setPage('share')}
          onViewRecord={() => setPage('detail')}
          onClose={onClose}
        />
      </View>
      {page === 'share' && (
        <ShareStudioScreen
          character={shownCharacter}
          run={run}
          onBack={() => setPage('complete')}
        />
      )}
      {page === 'detail' && (
        <RunDetailScreen
          character={shownCharacter}
          run={run}
          onBack={onRecordBack ?? (() => setPage('complete'))}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  hidden: { display: 'none' },
});
