import React from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {UserDocument} from '../../types/user.types';

type Props = {
  user: UserDocument | null;
  onRunPress: () => void;
  onNotificationPress: () => void;
};

const MINT = '#58CFA6';
const TEXT = '#151515';

export function HomeScreen({user, onRunPress, onNotificationPress}: Props) {
  const exp = user?.total_exp ?? 0;
  const totalKm = user?.total_km ?? 0;
  const level = Math.max(1, Math.floor(totalKm / 10) + 1);
  const currentExp = exp % 100;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.logo}>달료</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={onNotificationPress} style={styles.bellButton}>
          <Text style={styles.bellText}>⌕</Text>
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.levelCard}>
          <View style={styles.levelInfo}>
            <View style={styles.levelTitleRow}>
              <Text style={styles.levelMeta}>LV. {level}</Text>
              <Text style={styles.levelName}>신입 달리너</Text>
              <Text style={styles.levelExp}>{currentExp} / 100</Text>
            </View>
            <View style={styles.expTrack}>
              <View style={[styles.expFill, {width: `${Math.max(6, currentExp)}%`}]} />
            </View>
          </View>
        </View>

        <View style={styles.dashboardCard}>
          <Text style={styles.cardTitle}>나의 오늘 기록</Text>
          <View style={styles.statsRow}>
            <Metric icon="⌁" value="0" label="걸음" />
            <Metric icon="⌖" value="0.00" label="km" />
            <Metric icon="⌂" value="0" label="kcal" />
          </View>
        </View>

        <View style={styles.dashboardCard}>
          <Text style={styles.cardTitle}>이번 주 활동</Text>
          <View style={styles.weekRow}>
            {['월', '화', '수', '목', '금', '토', '일'].map(day => (
              <View key={day} style={styles.weekDay}>
                <Text style={styles.weekText}>{day}</Text>
                <View style={styles.weekDot} />
              </View>
            ))}
          </View>
          <Text style={styles.goalText}>
            <Text style={styles.goalStrong}>0</Text> / 5 목표 달성
          </Text>
        </View>

        <TouchableOpacity activeOpacity={0.86} onPress={onRunPress} style={styles.runCta}>
          <Text style={styles.runCtaText}>달리기 시작하기</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Metric({icon, value, label}: {icon: string; value: string; label: string}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6FEFF'},
  header: {minHeight: 118, paddingHorizontal: 30, paddingTop: 24, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'},
  logo: {color: MINT, fontSize: 44, fontWeight: '900', textShadowColor: 'rgba(88,207,166,0.16)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 1},
  bellButton: {width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 18, shadowColor: '#9ACAB8', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: {width: 0, height: 6}, elevation: 5},
  bellText: {color: '#5A5A5A', fontSize: 26, fontWeight: '900'},
  notificationDot: {position: 'absolute', right: 11, top: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: MINT},
  content: {paddingHorizontal: 28, paddingBottom: 118},
  levelCard: {minHeight: 100, borderRadius: 26, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, shadowColor: '#A7D7C4', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, elevation: 6},
  levelInfo: {flex: 1},
  levelTitleRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  levelMeta: {color: '#696969', fontSize: 18, fontWeight: '900', marginRight: 12},
  levelName: {color: TEXT, fontSize: 18, fontWeight: '900', flex: 1},
  levelExp: {color: '#4D4D4D', fontSize: 18, fontWeight: '900'},
  expTrack: {height: 8, borderRadius: 4, backgroundColor: '#E4E4E4', overflow: 'hidden'},
  expFill: {height: 8, borderRadius: 4, backgroundColor: '#FFD889'},
  dashboardCard: {borderRadius: 26, backgroundColor: '#FFFFFF', padding: 24, marginTop: 18, shadowColor: '#A7D7C4', shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: {width: 0, height: 8}, elevation: 5},
  cardTitle: {color: TEXT, fontSize: 20, fontWeight: '900', marginBottom: 18},
  statsRow: {flexDirection: 'row', justifyContent: 'space-between'},
  metric: {flex: 1, alignItems: 'center'},
  metricIcon: {color: '#9B9B9B', fontSize: 26, fontWeight: '900', marginBottom: 8},
  metricValue: {color: MINT, fontSize: 34, fontWeight: '900'},
  metricLabel: {color: '#777777', fontSize: 15, fontWeight: '800', marginTop: 6},
  weekRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 4},
  weekDay: {alignItems: 'center', width: 36},
  weekText: {color: '#7D7D7D', fontSize: 14, fontWeight: '900', marginBottom: 14},
  weekDot: {width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F0F0'},
  goalText: {textAlign: 'center', color: '#8A8A8A', fontSize: 18, fontWeight: '900', marginTop: 22},
  goalStrong: {color: '#1A9A75'},
  runCta: {height: 66, borderRadius: 28, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginTop: 26, shadowColor: MINT, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: {width: 0, height: 8}, elevation: 7},
  runCtaText: {color: '#FFFFFF', fontSize: 22, fontWeight: '900'},
});
