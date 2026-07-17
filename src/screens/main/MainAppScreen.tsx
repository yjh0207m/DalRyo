import React, {useState} from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {CommunityScreen} from '../community/CommunityScreen';
import {HomeScreen} from '../home/HomeScreen';
import {MyPageScreen} from '../profile/MyPageScreen';
import {GoalSetScreen} from '../run/GoalSetScreen';
import {RecordScreen} from '../run/RecordScreen';
import type {RunGoalType} from '../../types/run.types';
import type {UserDocument} from '../../types/user.types';

const images = {
  avatar: require('../../assets/images/dalryo-avatar.png'),
};

type MainTab = 'home' | 'community' | 'run' | 'records' | 'my';

type Props = {
  user: UserDocument | null;
};

const MINT = '#58CFA6';

export function MainAppScreen({user}: Props) {
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [goalDraft, setGoalDraft] = useState<{goalType: RunGoalType; goalValue: number | null} | null>(null);

  const openRunGoal = () => setActiveTab('run');

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        {activeTab === 'home' && <HomeScreen user={user} onRunPress={openRunGoal} onNotificationPress={() => undefined} />}
        {activeTab === 'community' && <CommunityScreen user={user} />}
        {activeTab === 'run' && (
          <GoalSetScreen
            onClose={() => setActiveTab('home')}
            onStart={(goalType, goalValue) => {
              setGoalDraft({goalType, goalValue});
              setActiveTab('home');
            }}
          />
        )}
        {activeTab === 'records' && <RecordScreen />}
        {activeTab === 'my' && <MyPageScreen user={user} />}
      </View>
      {!!goalDraft && (
        <View pointerEvents="none" style={styles.goalToast}>
          <Text style={styles.goalToastText}>목표 설정됨 · {goalDraft.goalType}</Text>
        </View>
      )}
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
}

function BottomNav({activeTab, onChange}: {activeTab: MainTab; onChange: (tab: MainTab) => void}) {
  return (
    <View style={styles.bottomNav}>
      <NavItem active={activeTab === 'home'} icon="⌂" label="홈" onPress={() => onChange('home')} />
      <NavItem active={activeTab === 'community'} icon="▣" label="커뮤니티" onPress={() => onChange('community')} />
      <TouchableOpacity activeOpacity={0.86} onPress={() => onChange('run')} style={styles.navRunButton}>
        <Text style={styles.navRunIcon}>✧</Text>
      </TouchableOpacity>
      <NavItem active={activeTab === 'records'} icon="▦" label="기록" onPress={() => onChange('records')} />
      <NavItem active={activeTab === 'my'} icon="⌾" label="마이페이지" onPress={() => onChange('my')} />
    </View>
  );
}

function NavItem({active, icon, label, onPress}: {active: boolean; icon: string; label: string; onPress: () => void}) {
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.navItem}>
      <View style={[styles.navIconWrap, active && styles.navIconActive]}>
        {label === '마이페이지' ? (
          <Image source={images.avatar} resizeMode="contain" style={[styles.navAvatar, active && styles.navAvatarActive]} />
        ) : (
          <Text style={[styles.navIcon, active && styles.navIconTextActive]}>{icon}</Text>
        )}
      </View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6FEFF'},
  body: {flex: 1},
  goalToast: {position: 'absolute', left: 48, right: 48, bottom: 108, minHeight: 42, borderRadius: 21, backgroundColor: 'rgba(21,21,21,0.72)', alignItems: 'center', justifyContent: 'center'},
  goalToastText: {color: '#FFFFFF', fontSize: 14, fontWeight: '900'},
  bottomNav: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, backgroundColor: 'rgba(255,255,255,0.96)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 14, borderTopWidth: 1, borderTopColor: 'rgba(199,224,215,0.55)'},
  navItem: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  navIconWrap: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center'},
  navIconActive: {backgroundColor: '#EFFFF8'},
  navIcon: {color: '#8E8E8E', fontSize: 25, fontWeight: '900'},
  navIconTextActive: {color: MINT},
  navAvatar: {width: 30, height: 30, opacity: 0.72},
  navAvatarActive: {opacity: 1},
  navLabel: {color: '#878787', fontSize: 11, fontWeight: '900', marginTop: 2},
  navLabelActive: {color: '#2BAF85'},
  navRunButton: {width: 74, height: 74, borderRadius: 37, backgroundColor: '#E7FFF7', borderWidth: 3, borderColor: '#A7E6CF', alignItems: 'center', justifyContent: 'center', marginTop: -34, shadowColor: '#9ADCC6', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: {width: 0, height: 7}, elevation: 8},
  navRunIcon: {color: MINT, fontSize: 36, fontWeight: '900'},
});
