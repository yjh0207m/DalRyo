import React, {useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {RunGoalType} from '../../types/run.types';

const MINT = '#58CFA6';
const TEXT = '#151515';

type Props = {
  onClose: () => void;
  onStart: (goalType: RunGoalType, goalValue: number | null) => void;
};

const goalOptions: Array<{type: RunGoalType; title: string; detail: string; value: number | null}> = [
  {type: 'free', title: '자유 달리기', detail: '오늘 컨디션대로 달려요', value: null},
  {type: 'time', title: '목표 시간', detail: '30분 달리기부터 시작해요', value: 30},
  {type: 'distance', title: '목표 거리', detail: '3km 거리 목표를 설정해요', value: 3},
  {type: 'calorie', title: '목표 칼로리', detail: '200kcal 소모를 목표로 해요', value: 200},
];

export function GoalSetScreen({onClose, onStart}: Props) {
  const [selected, setSelected] = useState(goalOptions[0]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>목표 선택</Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>오늘의 달리기를 정해볼까요?</Text>
        <Text style={styles.heroText}>목표를 선택하고 달리기를 시작해요.</Text>
      </View>
      <View style={styles.options}>
        {goalOptions.map(option => (
          <TouchableOpacity
            activeOpacity={0.86}
            key={option.type}
            onPress={() => setSelected(option)}
            style={[styles.goalOption, selected.type === option.type && styles.goalOptionActive]}>
            <View>
              <Text style={[styles.goalOptionTitle, selected.type === option.type && styles.goalOptionTitleActive]}>{option.title}</Text>
              <Text style={styles.goalOptionDetail}>{option.detail}</Text>
            </View>
            <Text style={[styles.goalOptionArrow, selected.type === option.type && styles.goalOptionTitleActive]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity activeOpacity={0.86} onPress={() => onStart(selected.type, selected.value)} style={styles.startButton}>
        <Text style={styles.startButtonText}>설정 확인하기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6FEFF', paddingHorizontal: 24, paddingBottom: 30},
  header: {height: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  backButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  backText: {color: TEXT, fontSize: 42, lineHeight: 42},
  title: {color: TEXT, fontSize: 28, fontWeight: '900'},
  heroCard: {borderRadius: 28, backgroundColor: '#EFFFF8', minHeight: 120, alignItems: 'center', justifyContent: 'center', padding: 24, borderWidth: 1, borderColor: '#C8F1E0'},
  heroTitle: {color: TEXT, fontSize: 23, fontWeight: '900'},
  heroText: {color: '#6D7472', fontSize: 15, fontWeight: '800', lineHeight: 22, textAlign: 'center', marginTop: 10},
  options: {marginTop: 22},
  goalOption: {height: 72, borderRadius: 20, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 14, borderWidth: 1, borderColor: '#E4ECE9'},
  goalOptionActive: {borderColor: MINT, backgroundColor: '#F1FFF9'},
  goalOptionTitle: {color: TEXT, fontSize: 18, fontWeight: '900'},
  goalOptionTitleActive: {color: '#23A67A'},
  goalOptionDetail: {color: '#777777', fontSize: 13, fontWeight: '700', marginTop: 5},
  goalOptionArrow: {color: '#B0B0B0', fontSize: 36, fontWeight: '700'},
  startButton: {height: 64, borderRadius: 24, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginTop: 'auto', shadowColor: MINT, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: {width: 0, height: 8}, elevation: 7},
  startButtonText: {color: '#FFFFFF', fontSize: 21, fontWeight: '900'},
});
