import React from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {CharacterDocument, CharacterType} from '../../types/character.types';
import type {UserDocument} from '../../types/user.types';

const images = {
  avatar: require('../../assets/images/dalryo-avatar.png'),
  penguin: require('../../assets/images/penguin_M.png'),
  rabbit: require('../../assets/images/rabbit_M.png'),
  duck: require('../../assets/images/duck_M.png'),
};

const characterImages: Record<CharacterType, number> = {
  penguin: images.penguin,
  rabbit: images.rabbit,
  duck: images.duck,
};

const MINT = '#58CFA6';
const TEXT = '#151515';

export function MyPageScreen({user, character}: {user: UserDocument | null; character: CharacterDocument | null}) {
  const characterSource = character ? characterImages[character.character_type] : images.avatar;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>마이페이지</Text>
        <View style={styles.headerActions}>
          <Text style={styles.headerIcon}>⌕</Text>
          <Text style={styles.headerIcon}>⚙</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <Image source={characterSource} resizeMode="contain" style={styles.profileImage} />
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{user?.display_name ?? '달리너'}</Text>
            <Text style={styles.profileDetail}>{user?.region ?? '지역 미설정'} · {user?.total_km?.toFixed(1) ?? '0.0'}km</Text>
          </View>
        </View>
        <InfoCard title="마이룸" detail="캐릭터 방 꾸미기와 방문 기능이 들어갈 자리예요." />
        <InfoCard title="캐릭터 성장 관리" detail="스탯, 단계, EXP, 돌 변신 상태를 보여줄 예정이에요." />
        <InfoCard title="아이템" detail="성장 아이템 판매와 보유함을 연결할 화면이에요." />
        <InfoCard title="설정" detail="프로필 편집, 사투리 변경, 알림 설정, 로그아웃을 묶을 예정이에요." />
      </ScrollView>
    </View>
  );
}

function InfoCard({title, detail}: {title: string; detail: string}) {
  return (
    <View style={styles.infoCard}>
      <View>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoDetail}>{detail}</Text>
      </View>
      <Text style={styles.infoArrow}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6FEFF'},
  header: {minHeight: 104, paddingHorizontal: 30, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  headerTitle: {color: TEXT, fontSize: 32, fontWeight: '900'},
  headerActions: {flexDirection: 'row', gap: 12},
  headerIcon: {width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', color: '#555555', fontSize: 22, fontWeight: '900', textAlign: 'center', lineHeight: 42},
  content: {paddingHorizontal: 24, paddingBottom: 128},
  profileCard: {borderRadius: 26, backgroundColor: '#FFFFFF', padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 4, borderWidth: 1, borderColor: '#E4ECE9'},
  profileImage: {width: 72, height: 72, borderRadius: 20},
  profileText: {marginLeft: 16},
  profileName: {color: TEXT, fontSize: 22, fontWeight: '900'},
  profileDetail: {color: '#777777', fontSize: 14, fontWeight: '800', marginTop: 6},
  infoCard: {minHeight: 92, borderRadius: 22, backgroundColor: '#FFFFFF', padding: 20, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(88,207,166,0.16)'},
  infoTitle: {color: TEXT, fontSize: 19, fontWeight: '900'},
  infoDetail: {color: '#787878', fontSize: 13, fontWeight: '700', marginTop: 8, maxWidth: 250},
  infoArrow: {color: MINT, fontSize: 38, fontWeight: '700'},
});
