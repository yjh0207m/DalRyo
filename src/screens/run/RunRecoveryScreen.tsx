import React, {useState} from 'react';
import {Alert, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AppText, Button, Card} from '../../components/ui';
import {commandRun} from '../../services/runJournal.service';
import type {RunSessionSnapshot} from '../../types/runSession';
import {colors, spacing} from '../../theme';
import {formatClock} from '../../utils/pace';

export function RunRecoveryScreen({session, onResume, onSave, onDiscard}: {
  session: RunSessionSnapshot;
  onResume: () => void;
  onSave: (session: RunSessionSnapshot) => void;
  onDiscard: () => void;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try {const final = await commandRun(session, 'finish'); if (final) onSave(final);}
    catch {setError('기기 기록을 마무리하지 못했어요. 다시 시도해 주세요.');}
    finally {setBusy(false);}
  };
  const discard = () => Alert.alert('남은 기록을 버릴까요?', '버린 기록은 복구할 수 없어요.', [
    {text: '취소', style: 'cancel'}, {text: '버리기', style: 'destructive', onPress: async () => {
      setBusy(true);
      try {await commandRun(session, 'clear'); onDiscard();} catch {setError('기록을 지우지 못했어요. 다시 시도해 주세요.');} finally {setBusy(false);}
    }},
  ]);
  return <SafeAreaView style={styles.screen}><StatusBar barStyle="dark-content" backgroundColor={colors.background}/><View style={styles.content}>
    <AppText variant="heading">남아 있는 달리기가 있어요</AppText>
    <AppText color={colors.textMuted}>{session.interrupted ? '앱이 중단되기 전 마지막 기록을 불러왔어요. 기록하지 못한 시간과 거리는 더하지 않아요.' : '이전에 시작한 기록을 이어서 확인할 수 있어요.'}</AppText>
    <Card><AppText variant="heading">{session.distanceKm.toFixed(2)}km · {formatClock(Math.floor(session.elapsedMs / 1000))}</AppText>
      <AppText variant="caption">{new Date(session.startedAtMs).toLocaleString('ko-KR')}</AppText>
    </Card>
    {!!error && <AppText accessibilityRole="alert" color={colors.danger}>{error}</AppText>}
    {session.phase !== 'finished' && <Button label="달리기 이어가기" disabled={busy} onPress={onResume}/>}
    <Button label="여기까지 기록 저장" disabled={busy} onPress={save}/>
    <Button label="기록 버리기" variant="ghost" disabled={busy} onPress={discard}/>
  </View></SafeAreaView>;
}
const styles = StyleSheet.create({screen: {flex: 1, backgroundColor: colors.background}, content: {flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg}});
