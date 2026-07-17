import React, {useEffect, useState} from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {subscribeUserPosts, type FeedPost} from '../../services/feed.service';

const MINT = '#58CFA6';
const MINT_DEEP = '#2BAF85';
const TEXT = '#1A1A1A';
const MUTED = '#9A9A9A';
const SCREEN_W = Dimensions.get('window').width;
const GRID_CELL = (SCREEN_W - 4) / 3;

const images = {avatar: require('../../assets/images/dalryo-avatar.png')};

type Props = {
  visible: boolean;
  uid: string;
  name: string;
  onClose: () => void;
};

export function UserProfileModal({visible, uid, name, onClose}: Props) {
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    if (!visible || !uid) return;
    return subscribeUserPosts(uid, setPosts);
  }, [visible, uid]);

  const totalKm = posts.reduce((acc, p) => acc + (p.distance_km ?? 0), 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.headerName}>{name}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={posts}
            keyExtractor={p => p.post_id}
            numColumns={3}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.gridRow}
            ListHeaderComponent={
              <View style={styles.profileSection}>
                <Image source={images.avatar} style={styles.avatar} resizeMode="cover" />
                <Text style={styles.profileName}>{name}</Text>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{posts.length}</Text>
                    <Text style={styles.statLabel}>러닝 일지</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{totalKm.toFixed(1)}</Text>
                    <Text style={styles.statLabel}>누적 km</Text>
                  </View>
                </View>

                <View style={styles.gridHeaderRow}>
                  <Text style={styles.gridHeaderText}>러닝 일지 {posts.length}개</Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>🏃</Text>
                <Text style={styles.emptyText}>아직 공개 일지가 없어요</Text>
              </View>
            }
            renderItem={({item}) => (
              <View style={styles.gridItem}>
                {item.image_url ? (
                  <Image source={{uri: item.image_url}} style={styles.gridImage} resizeMode="cover" />
                ) : (
                  <View style={styles.gridPlaceholder}>
                    <Text style={styles.gridPlaceholderEmoji}>🏃</Text>
                    <Text style={styles.gridPlaceholderText} numberOfLines={3}>{item.text}</Text>
                  </View>
                )}
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)'},
  backdrop: {flex: 1},
  sheet: {backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%'},
  handle: {width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginTop: 12, marginBottom: 4},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0'},
  headerName: {flex: 1, color: TEXT, fontSize: 16, fontWeight: '900'},
  closeBtn: {width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center'},
  closeBtnText: {color: '#555', fontSize: 13, fontWeight: '700'},
  profileSection: {alignItems: 'center', paddingTop: 24, paddingBottom: 8},
  avatar: {width: 80, height: 80, borderRadius: 40, marginBottom: 12, borderWidth: 3, borderColor: MINT},
  profileName: {color: TEXT, fontSize: 20, fontWeight: '900', marginBottom: 16},
  statsRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 20},
  statItem: {alignItems: 'center', paddingHorizontal: 24},
  statValue: {color: MINT_DEEP, fontSize: 22, fontWeight: '900'},
  statLabel: {color: MUTED, fontSize: 12, fontWeight: '700', marginTop: 2},
  statDivider: {width: 1, height: 32, backgroundColor: '#E8E8E8'},
  gridHeaderRow: {alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingHorizontal: 16, paddingVertical: 12},
  gridHeaderText: {color: TEXT, fontSize: 14, fontWeight: '800'},
  gridRow: {gap: 2},
  gridItem: {width: GRID_CELL, height: GRID_CELL, backgroundColor: '#F5F5F5'},
  gridImage: {width: '100%', height: '100%'},
  gridPlaceholder: {flex: 1, padding: 8, justifyContent: 'center', alignItems: 'center', gap: 4},
  gridPlaceholderEmoji: {fontSize: 18},
  gridPlaceholderText: {color: MUTED, fontSize: 10, fontWeight: '600', textAlign: 'center'},
  emptyWrap: {alignItems: 'center', paddingVertical: 48},
  emptyEmoji: {fontSize: 36, marginBottom: 10},
  emptyText: {color: MUTED, fontSize: 14, fontWeight: '700'},
});
