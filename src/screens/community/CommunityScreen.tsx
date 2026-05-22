import React, {useEffect, useState} from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {subscribeMyFeed, type FeedPost} from '../../services/feed.service';

const images = {
  avatar: require('../../assets/images/dalryo-avatar.png'),
  bgDay: require('../../assets/images/bg-day.png'),
};

const MINT = '#58CFA6';
const TEXT = '#151515';

export function CommunityScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => subscribeMyFeed(setPosts), []);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>커뮤니티</Text>
        <View style={styles.headerActions}>
          <Text style={styles.headerIcon}>⌕</Text>
          <Text style={styles.headerIcon}>⚙</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.searchBox}>
          <Text style={styles.searchText}>친구, 오운완, 같이달리기 검색</Text>
        </View>
        <View style={styles.feedTabs}>
          {['전체 피드', '친구', '같이달리기'].map((tab, index) => (
            <View key={tab} style={[styles.feedTab, index === 0 && styles.feedTabActive]}>
              <Text style={[styles.feedTabText, index === 0 && styles.feedTabTextActive]}>{tab}</Text>
            </View>
          ))}
        </View>
        {posts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Image source={images.avatar} resizeMode="contain" style={styles.emptyImage} />
            <Text style={styles.emptyTitle}>아직 피드가 비어 있어요</Text>
            <Text style={styles.emptyText}>F-FEED-02 기준으로 users/{'{uid}'}/feed를 실시간 구독하고 있어요.</Text>
          </View>
        ) : (
          posts.map(post => (
            <View key={post.post_id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Image source={post.author_image ? {uri: post.author_image} : images.avatar} resizeMode="cover" style={styles.postAvatar} />
                <View>
                  <Text style={styles.postName}>{post.author_name}</Text>
                  <Text style={styles.postMeta}>{post.hashtags.join('  ')}</Text>
                </View>
              </View>
              <Image source={images.bgDay} resizeMode="cover" style={styles.postImage} />
              <Text style={styles.postText}>{post.text}</Text>
              <View style={styles.postActions}>
                <Text style={styles.postAction}>응원 {post.like_count}</Text>
                <Text style={styles.postAction}>댓글 {post.comment_count}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  searchBox: {height: 52, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: '#E3ECE8'},
  searchText: {color: '#A0A0A0', fontSize: 15, fontWeight: '800'},
  feedTabs: {flexDirection: 'row', gap: 10, marginVertical: 16},
  feedTab: {height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: '#E4ECE9'},
  feedTabActive: {backgroundColor: MINT, borderColor: MINT},
  feedTabText: {color: '#777777', fontSize: 14, fontWeight: '900'},
  feedTabTextActive: {color: '#FFFFFF'},
  emptyCard: {borderRadius: 24, backgroundColor: '#FFFFFF', padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E7EFEC'},
  emptyImage: {width: 90, height: 90},
  emptyTitle: {color: TEXT, fontSize: 21, fontWeight: '900', marginTop: 12},
  emptyText: {color: '#777777', fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 22, marginTop: 8},
  postCard: {borderRadius: 24, backgroundColor: '#FFFFFF', padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E7EFEC'},
  postHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 14},
  postAvatar: {width: 44, height: 44, borderRadius: 14, marginRight: 12},
  postName: {color: TEXT, fontSize: 16, fontWeight: '900'},
  postMeta: {color: '#7D7D7D', fontSize: 12, fontWeight: '800', marginTop: 3},
  postImage: {height: 210, borderRadius: 18, overflow: 'hidden'},
  postText: {color: '#444444', fontSize: 15, fontWeight: '700', lineHeight: 22, marginTop: 14},
  postActions: {flexDirection: 'row', gap: 14, marginTop: 14},
  postAction: {color: '#2BAF85', fontSize: 14, fontWeight: '900'},
});
