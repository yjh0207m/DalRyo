import React, {useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {SafeAreaView} from 'react-native-safe-area-context';
import {createFeedPost} from '../../services/feed.service';
import type {UserDocument} from '../../types/user.types';

const MINT = '#58CFA6';
const TEXT = '#151515';
const MAX_PHOTOS = 5;

type Props = {
  user: UserDocument | null;
  onClose: () => void;
  onPosted: () => void;
};

type Visibility = 'public' | 'followers' | 'private';
const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: '전체 공개',
  followers: '팔로워',
  private: '나만 보기',
};

export function WritePostScreen({user, onClose, onPosted}: Props) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [isPosting, setIsPosting] = useState(false);

  const canPost = text.trim().length > 0 && !isPosting;

  const handleAddPhoto = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: MAX_PHOTOS - photos.length,
      },
      response => {
        if (response.didCancel || response.errorCode) return;
        if (response.assets) {
          const uris = response.assets
            .map(a => a.uri)
            .filter((u): u is string => Boolean(u));
          setPhotos(prev => [...prev, ...uris].slice(0, MAX_PHOTOS));
        }
      },
    );
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!canPost) return;
    setIsPosting(true);
    try {
      await createFeedPost({
        text: text.trim(),
        authorName: user?.display_name ?? '달리너',
        authorImage: null,
        imageUri: photos[0] ?? null,
        visibility,
        dialect: user?.dialect ?? 'seoul',
      });
      onPosted();
    } catch (e) {
      console.error('[WritePost] 등록 실패:', e);
      Alert.alert('오류', '게시물 등록에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setIsPosting(false);
    }
  };

  const cycleVisibility = () => {
    setVisibility(v => (v === 'public' ? 'followers' : v === 'followers' ? 'private' : 'public'));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>글쓰기</Text>
        <TouchableOpacity
          activeOpacity={0.82}
          disabled={!canPost}
          onPress={handlePost}
          style={[styles.postButton, !canPost && styles.postButtonDisabled]}>
          <Text style={[styles.postButtonText, !canPost && styles.postButtonTextDisabled]}>
            {isPosting ? '등록 중' : '등록'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* 사진 추가 */}
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionLabel}>
              사진 추가{photos.length > 0 ? ` (${photos.length}/${MAX_PHOTOS})` : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {photos.length < MAX_PHOTOS && (
                <TouchableOpacity activeOpacity={0.8} style={styles.photoAdd} onPress={handleAddPhoto}>
                  <Text style={styles.photoAddIcon}>＋</Text>
                </TouchableOpacity>
              )}
              {photos.map((uri, i) => (
                <View key={i} style={styles.photoThumbWrap}>
                  <Image source={{uri}} style={styles.photoThumb} />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.photoRemoveBtn}
                    onPress={() => handleRemovePhoto(i)}>
                    <Text style={styles.photoRemoveIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.divider} />

          {/* 텍스트 입력 */}
          <View style={styles.textSection}>
            <TextInput
              value={text}
              onChangeText={t => setText(t.slice(0, 500))}
              multiline
              placeholder={'오늘의 러닝 기록, 팁, 그인 등\n이야기를 나눠보세요! 🏃‍♀️🏃'}
              placeholderTextColor="#B0B0B0"
              style={styles.textInput}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{text.length}/500</Text>
          </View>

          <View style={styles.divider} />

          {/* 옵션 */}
          <OptionRow icon="👤" label="사람 태그" value="태그하기 ›" />
          <OptionRow icon="📍" label="위치 추가" value="위치 추가 ›" />
          <OptionRow icon="🎵" label="오디오 추가" value="추가하기 ›" />
          <TouchableOpacity activeOpacity={0.8} onPress={cycleVisibility} style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text style={styles.optionIcon}>🌐</Text>
              <Text style={styles.optionLabel}>공개 대상 설정</Text>
            </View>
            <Text style={styles.optionValue}>{VISIBILITY_LABELS[visibility]} ›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* 달료 캐릭터 배너 */}
          <View style={styles.promoBanner}>
            <View style={styles.promoText}>
              <Text style={styles.promoTitle}>함께 나누면 더 즐거워요!</Text>
              <Text style={styles.promoSub}>러닝의 즐거움을 달료 친구들과 나눠보세요.</Text>
            </View>
            <Text style={styles.promoEmoji}>🐧👋</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OptionRow({icon, label, value}: {icon: string; label: string; value: string}) {
  return (
    <View style={styles.optionRow}>
      <View style={styles.optionLeft}>
        <Text style={styles.optionIcon}>{icon}</Text>
        <Text style={styles.optionLabel}>{label}</Text>
      </View>
      <Text style={styles.optionValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0'},
  backButton: {width: 40, height: 40, justifyContent: 'center'},
  backIcon: {color: TEXT, fontSize: 38, lineHeight: 40},
  headerTitle: {color: TEXT, fontSize: 18, fontWeight: '900'},
  postButton: {backgroundColor: MINT, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8},
  postButtonDisabled: {backgroundColor: '#D8D8D8'},
  postButtonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '900'},
  postButtonTextDisabled: {color: '#AAAAAA'},
  photoSection: {paddingTop: 18, paddingBottom: 14},
  photoSectionLabel: {color: '#888888', fontSize: 13, fontWeight: '800', paddingHorizontal: 20, marginBottom: 12},
  photoRow: {paddingHorizontal: 20, gap: 10},
  photoAdd: {width: 80, height: 80, borderRadius: 14, backgroundColor: '#F1FAF6', borderWidth: 1.5, borderColor: '#B6E6D0', alignItems: 'center', justifyContent: 'center'},
  photoAddIcon: {color: MINT, fontSize: 30, fontWeight: '300'},
  photoThumbWrap: {width: 80, height: 80, borderRadius: 14, overflow: 'visible'},
  photoThumb: {width: 80, height: 80, borderRadius: 14},
  photoRemoveBtn: {position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, backgroundColor: '#333333', alignItems: 'center', justifyContent: 'center'},
  photoRemoveIcon: {color: '#FFFFFF', fontSize: 10, fontWeight: '900'},
  divider: {height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 0},
  textSection: {padding: 20, minHeight: 160},
  textInput: {color: TEXT, fontSize: 16, fontWeight: '500', lineHeight: 26, minHeight: 120},
  charCount: {color: '#BBBBBB', fontSize: 13, fontWeight: '700', textAlign: 'right', marginTop: 8},
  optionRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5'},
  optionLeft: {flexDirection: 'row', alignItems: 'center', gap: 12},
  optionIcon: {fontSize: 20},
  optionLabel: {color: TEXT, fontSize: 15, fontWeight: '800'},
  optionValue: {color: '#AAAAAA', fontSize: 14, fontWeight: '700'},
  promoBanner: {margin: 20, borderRadius: 18, backgroundColor: '#F0FDF8', padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  promoText: {flex: 1},
  promoTitle: {color: '#2BAF85', fontSize: 15, fontWeight: '900'},
  promoSub: {color: '#7ABDA0', fontSize: 13, fontWeight: '700', marginTop: 4},
  promoEmoji: {fontSize: 36, marginLeft: 12},
});
