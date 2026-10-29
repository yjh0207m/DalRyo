import React, {useEffect, useState} from 'react';
import {BackHandler, ScrollView, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ChevronLeft} from 'lucide-react-native';
import {CharacterView} from '../../components/character/CharacterView';
import type {RevealMode} from '../../components/character/CharacterReveal';
import {CompletedRunScreen} from '../run/CompletedRunScreen';
import {Timestamp} from '@react-native-firebase/firestore';
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
// 완료 화면 연출 미리보기용 가짜 기록 (저장하지 않는다)
const REVEAL_DEMOS: Array<{mode: RevealMode; label: string; before: CharacterStage; after: CharacterStage; totalKmBefore: number; frozen?: boolean}> = [
  {mode: 'complete', label: '완주', before: 'baby', after: 'baby', totalKmBefore: 12},
  {mode: 'hatch', label: '부화', before: 'egg', after: 'baby', totalKmBefore: 0},
  {mode: 'grow', label: '성장', before: 'baby', after: 'child', totalKmBefore: 48},
  {mode: 'thaw', label: '해동', before: 'baby', after: 'baby', totalKmBefore: 20, frozen: true},
];
// 여의도 한강공원 근처를 한 바퀴 도는 가짜 경로 (출발과 도착이 살짝 떨어져 있다)
const DEMO_ROUTE = Array.from({length: 60}, (_, i) => {
  const a = (i / 60) * Math.PI * 1.85;
  return {lat: 37.5265 + 0.004 * Math.sin(a), lng: 126.9335 + 0.007 * (1 - Math.cos(a)), timestamp: i * 20000};
});
const crawlCandidate: number = require('../../../assets/rive/rabbit-crawl-candidate.riv');

// 개발 빌드에서만 마이 페이지에 노출한다. 계정/캐릭터 데이터는 변경하지 않는다.
export function CharacterPreviewScreen({onBack}: {onBack: () => void}) {
  const [stage, setStage] = useState<CharacterStage>('baby');
  const [motion, setMotion] = useState<CharacterMotion>('idle');
  const [jumpKey, setJumpKey] = useState(0);
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [candidate, setCandidate] = useState(true);
  const [demo, setDemo] = useState<(typeof REVEAL_DEMOS)[number] | null>(null);
  useEffect(() => {
    if (demo) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {onBack(); return true;});
    return () => sub.remove();
  }, [onBack, demo]);

  if (demo) {
    return (
      <CompletedRunScreen
        run={{run_id:'preview-only',uid:'preview-only',goal_type:'free',goal_value:null,
          started_at:Timestamp.fromMillis(Date.now()-1268000),ended_at:Timestamp.now(),created_at:Timestamp.now(),
          distance_km:3.24,duration_sec:1268,avg_pace_sec:391,avg_speed_kmh:9.2,calories:214,
          route:DEMO_ROUTE,avg_heart_rate:null,park_id:null,exp_earned:32}}
        character={{uid:'preview-only',character_type:'rabbit',pet_name:'달료',stage:demo.after,
          exp:0,stat_stamina:0,stat_speed:0,stat_endurance:0,last_active_at:Timestamp.now(),created_at:Timestamp.now(),updated_at:Timestamp.now()}}
        before={{stageBefore:demo.before,totalKmBefore:demo.totalKmBefore,wasFrozen:demo.frozen??false}}
        onClose={() => setDemo(null)}
      />
    );
  }

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
      <AppText variant="subheading">달리기 완료 연출</AppText>
      <View style={styles.row}>{REVEAL_DEMOS.map(item => <Button key={item.mode} size="md" variant="secondary" label={item.label} onPress={() => setDemo(item)} style={styles.half} />)}</View>
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
