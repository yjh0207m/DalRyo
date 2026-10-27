import React, {useEffect, useState} from 'react';
import {BackHandler, ScrollView, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ChevronLeft} from 'lucide-react-native';
import {CharacterView} from '../../components/character/CharacterView';
import {AppText, Button, Card, IconButton} from '../../components/ui';
import {colors, spacing} from '../../theme';
import type {CharacterMotion, CharacterStage} from '../../types/character.types';

const MOTIONS: Array<{value: CharacterMotion; label: string}> = [
  {value: 'idle', label: '대기'}, {value: 'rest', label: '휴식'},
  {value: 'slow', label: '걷기'}, {value: 'run', label: '달리기'},
  {value: 'sprint', label: '전력질주'}, {value: 'stone', label: '돌 상태'},
];
const STAGES: Array<{value: CharacterStage; label: string}> = [
  {value: 'baby', label: '아기'}, {value: 'child', label: '어린이'}, {value: 'runner', label: '러너'},
];
const crawlCandidate: number = require('../../../assets/rive/rabbit-crawl-candidate.riv');

// 개발 빌드에서만 마이 페이지에 노출한다. 계정/캐릭터 데이터는 변경하지 않는다.
export function CharacterPreviewScreen({onBack}: {onBack: () => void}) {
  const [stage, setStage] = useState<CharacterStage>('baby');
  const [motion, setMotion] = useState<CharacterMotion>('idle');
  const [jumpKey, setJumpKey] = useState(0);
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [candidate, setCandidate] = useState(true);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {onBack(); return true;});
    return () => sub.remove();
  }, [onBack]);

  return <SafeAreaView style={styles.screen}>
    <StatusBar barStyle="dark-content" />
    <View style={styles.header}>
      <IconButton icon={ChevronLeft} accessibilityLabel="뒤로" variant="plain" onPress={onBack} />
      <AppText variant="heading">캐릭터 미리보기</AppText>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="caption" color={colors.textMuted}>개발용 · 실제 캐릭터 정보는 바뀌지 않아요</AppText>
      <Card style={styles.stage}>
        <CharacterView type="rabbit" stage={stage} motion={motion} jumpKey={jumpKey} facing={facing} size={280} previewRiveSource={candidate && stage === 'baby' ? crawlCandidate : undefined} />
      </Card>
      <AppText variant="caption">{candidate && stage === 'baby' && motion !== 'stone' ? '전체 그림 동작 후보 · 검수 중' : '원본 PNG'} / {MOTIONS.find(item => item.value === motion)?.label}</AppText>
      <Button size="md" variant="secondary" label={candidate ? '원본과 비교' : '새 동작 후보 보기'} onPress={() => setCandidate(value => !value)} />
      <View style={styles.row}>{STAGES.map(item => <Button key={item.value} size="md" label={item.label} variant={stage === item.value ? 'primary' : 'secondary'} onPress={() => setStage(item.value)} style={styles.third} />)}</View>
      <View style={styles.row}>{MOTIONS.map(item => <Button key={item.value} size="md" label={item.label} variant={motion === item.value ? 'primary' : 'secondary'} onPress={() => setMotion(item.value)} style={styles.half} />)}</View>
      <View style={styles.row}>
        <Button label="점프" disabled={motion === 'stone'} onPress={() => setJumpKey(value => value + 1)} style={styles.half} />
        <Button label="방향 전환" variant="secondary" onPress={() => setFacing(value => value === 'right' ? 'left' : 'right')} style={styles.half} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  header: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md},
  content: {padding: spacing.xl, gap: spacing.md},
  stage: {alignItems: 'center', paddingVertical: spacing.md},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  half: {width: '48%'},
  third: {flex: 1},
});