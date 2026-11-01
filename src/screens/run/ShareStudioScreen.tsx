import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronLeft, Share2 } from 'lucide-react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import NativeShare from 'react-native-share';
import type { Asset } from 'react-native-image-picker';
import {
  AppText,
  Button,
  IconButton,
  PhotoSourceSheet,
} from '../../components/ui';
import { choosePhoto, uploadPhoto } from '../../services/media.service';
import { runInBackground } from '../../services/backgroundTask.service';
import {
  newSocialId,
  socialError,
  socialRequest,
} from '../../services/social.service';
import { fetchCharacterImageUrl } from '../../services/character.service';
import { fetchRunDistrict } from '../../services/runLocation.service';
import { fetchCurrentUserDocument } from '../../services/user.service';
import type { CharacterDocument } from '../../types/character.types';
import type { RunDocument } from '../../types/run.types';
import { formatDuration, formatPace } from '../../utils/pace';
import {
  MAX_CONTENT_LENGTH,
  MAX_TAG_INPUT_LENGTH,
  buildPostText,
} from '../../utils/shareCard';
import { colors, radius, shadow, spacing } from '../../theme';

type Props = {
  character: CharacterDocument | null;
  run?: RunDocument;
  onBack: () => void;
  // 피드에 올리기를 맡긴 직후 호출된다. 업로드는 뒤에서 이어지므로 바로 피드로 보내면 된다
  onPosted?: () => void;
};
export function ShareStudioScreen({ character, run, onBack, onPosted }: Props) {
  const card = useRef<View>(null);
  const lock = useRef(false);
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [photoReady, setPhotoReady] = useState(true);
  const [characterUrl, setCharacterUrl] = useState<string | null>(null);
  const [characterReady, setCharacterReady] = useState(false);
  const [showCharacter, setShowCharacter] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [right, setRight] = useState(true);
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [posted, setPosted] = useState(false);
  // 게시물 내용과 태그는 비워 두고 직접 쓰게 한다. 비워도 올릴 수 있다
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  // 공개 설정은 위치만 있다. 기본은 비공개이고, 공개하면 시·도·구 단위까지만 본문에 들어간다
  const [shareLocation, setShareLocation] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  // 같은 카드는 한 번만 게시되도록 게시물 ID를 화면이 열려 있는 동안 고정한다. 실패 후 다시 눌러도 중복되지 않는다
  const [postId] = useState(() => newSocialId());
  const characterType = character?.character_type;
  const characterStage = character?.stage;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!lock.current) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  useEffect(() => {
    let active = true;
    setCharacterReady(false);
    setCharacterUrl(null);
    setImageError(false);
    if (!characterType || !characterStage) {
      setCharacterReady(true);
      return;
    }
    if (characterStage === 'egg') return;
    fetchCharacterImageUrl(characterType, characterStage)
      .then(url => {
        if (active) setCharacterUrl(url);
      })
      .catch(() => {
        if (active) setImageError(true);
      });
    return () => {
      active = false;
    };
  }, [characterType, characterStage]);
  useEffect(() => {
    let active = true;
    setLocation(null);
    setLocationLoading(true);
    // 달린 출발 지점을 시·도·구로 바꾸고, 알 수 없으면 프로필에 적어 둔 지역을 쓴다
    const resolve = async () => {
      const district = run ? await fetchRunDistrict(run) : null;
      if (district) return district;
      const user = await fetchCurrentUserDocument().catch(() => null);
      return user?.region?.trim() || null;
    };
    resolve()
      .then(label => {
        if (active) setLocation(label);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLocationLoading(false);
      });
    return () => {
      active = false;
    };
  }, [run]);
  const select = async (camera: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const asset = await choosePhoto(camera);
      if (asset) {
        setPhotoReady(false);
        setPhoto(asset);
      }
    } catch (error) {
      Alert.alert(
        '사진을 열지 못했어요',
        error instanceof Error ? error.message : '다시 시도해 주세요.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const cardReady =
    photoReady && !(showCharacter && !!character && !characterReady);
  // 완성된 카드를 png 이미지로 만들어 다른 앱으로 공유한다
  const share = async () => {
    if (lock.current || !cardReady) return;
    lock.current = true;
    setBusy(true);
    let uri: string | undefined;
    try {
      uri = await captureRef(card, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: 1080,
        height: 1350,
      });
      await NativeShare.open({
        title: '달료 오운완',
        url: uri.startsWith('file://') ? uri : `file://${uri}`,
        type: 'image/png',
        filename: 'dalryo-run',
        failOnCancel: false,
        useInternalStorage: true,
      });
    } catch (error) {
      Alert.alert(
        '공유 카드를 만들지 못했어요',
        error instanceof Error ? error.message : '다시 시도해 주세요.',
      );
    } finally {
      if (uri) releaseCapture(uri);
      lock.current = false;
      setBusy(false);
    }
  };
  const post = async () => {
    if (lock.current || !cardReady || posted) return;
    lock.current = true;
    setBusy(true);
    let captured: string;
    try {
      // 피드에는 용량이 작은 jpg로 올린다
      captured = await captureRef(card, {
        format: 'jpg',
        quality: 0.9,
        result: 'tmpfile',
        width: 1080,
        height: 1350,
      });
    } catch (error) {
      Alert.alert(
        '카드를 만들지 못했어요',
        error instanceof Error ? error.message : '다시 시도해 주세요.',
      );
      lock.current = false;
      setBusy(false);
      return;
    }
    const fileUri = captured.startsWith('file://')
      ? captured
      : `file://${captured}`;
    const text = buildPostText({
      content,
      tags,
      location: shareLocation ? location : null,
    });
    // 업로드와 게시는 서버가 하는 일이라 기다리지 않고 뒤에서 이어 간다. 진행과 실패는 작은 팝업으로 알린다
    runInBackground({
      label: '게시물 올리는 중',
      successLabel: '게시물을 올렸어요',
      failureLabel: '게시물을 올리지 못했어요',
      describeError: socialError,
      task: async report => {
        const uploaded = await uploadPhoto(
          { uri: fileUri, type: 'image/jpeg' },
          'posts',
          report,
        );
        await socialRequest('createPost', {
          postId,
          text,
          visibility: 'public',
          imageUrl: uploaded.url,
          runId: run?.run_id ?? null,
        });
      },
      // 다시 시도할 수 있도록 성공하거나 포기할 때까지 캡처 파일을 남겨 둔다
      cleanup: () => releaseCapture(captured),
    });
    setPosted(true);
    lock.current = false;
    setBusy(false);
    onPosted?.();
  };
  const imageSource =
    character?.stage === 'egg'
      ? require('../../assets/images/egg.png')
      : characterUrl
      ? { uri: characterUrl }
      : null;
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <IconButton
          icon={ChevronLeft}
          variant="plain"
          accessibilityLabel="공유 카드에서 뒤로"
          disabled={busy}
          onPress={onBack}
        />
        <AppText variant="heading" style={styles.headerTitle}>
          오운완 카드
        </AppText>
        <IconButton
          icon={Share2}
          variant="plain"
          accessibilityLabel="이미지 공유"
          disabled={busy || !cardReady}
          onPress={share}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* 아이폰 초기 모델 모양 틀. 카드가 화면이고 카메라 버튼이 홈 버튼 자리에 온다 */}
        <View style={styles.phone}>
          <View style={styles.phoneTop}>
            <View style={styles.sensor} />
            <View style={styles.speaker} />
          </View>
          <View ref={card} collapsable={false} style={styles.card}>
            {photo && (
              <Image
                source={{ uri: photo.uri }}
                style={styles.background}
                resizeMode="cover"
                onLoad={() => setPhotoReady(true)}
                onError={() => {
                  setPhotoReady(false);
                  Alert.alert(
                    '사진을 표시하지 못했어요',
                    '다른 사진을 선택해 주세요.',
                  );
                }}
              />
            )}
            <View style={styles.shade} />
            <View style={styles.brand}>
              <AppText style={styles.white} variant="heading">
                달료
              </AppText>
              <AppText style={styles.white} variant="caption">
                오늘도 한 걸음, 나답게
              </AppText>
            </View>
            {showCharacter && imageSource && (
              <Image
                source={imageSource}
                resizeMode="contain"
                style={[styles.character, right ? styles.right : styles.left]}
                onLoad={() => setCharacterReady(true)}
                onError={() => {
                  setCharacterReady(false);
                  setImageError(true);
                }}
              />
            )}
            {run && showStats && (
              <View style={styles.stats}>
                <AppText variant="display" style={styles.white}>
                  {run.distance_km.toFixed(2)}
                  <AppText variant="subheading" style={styles.white}>
                    {' '}
                    km
                  </AppText>
                </AppText>
                <AppText variant="subheading" style={styles.white}>
                  {formatDuration(run.duration_sec)} ·{' '}
                  {run.distance_km > 0 ? formatPace(run.avg_pace_sec) : '—'} /km
                </AppText>
                <AppText variant="caption" style={styles.white}>
                  {run.calories} kcal · #오운완
                </AppText>
              </View>
            )}
            <AppText variant="label" style={styles.watermark}>
              DALRYO · RUN WITH ME
            </AppText>
          </View>
          {/* 카드(캡처 대상) 밖의 틀에 있어 게시 이미지에는 버튼이 찍히지 않는다 */}
          <View style={styles.phoneBottom}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photo ? '사진 변경' : '사진 추가'}
              disabled={busy}
              onPress={() => setSheetOpen(true)}
              style={({ pressed }) => [
                styles.homeButton,
                pressed && styles.homePressed,
                busy && styles.homeDisabled,
              ]}
            >
              <Camera color={colors.primaryInk} size={24} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
        {character && (
          <Button
            label={showCharacter ? '캐릭터 숨기기' : '캐릭터 표시'}
            size="md"
            variant="secondary"
            disabled={busy}
            onPress={() => setShowCharacter(v => !v)}
          />
        )}
        {showCharacter && character && (
          <Button
            label={right ? '캐릭터를 왼쪽으로' : '캐릭터를 오른쪽으로'}
            size="md"
            variant="secondary"
            disabled={busy}
            onPress={() => setRight(v => !v)}
          />
        )}
        {run && (
          <Button
            label={showStats ? '기록 숨기기' : '기록 표시'}
            size="md"
            variant="secondary"
            disabled={busy}
            onPress={() => setShowStats(v => !v)}
          />
        )}
        {imageError && showCharacter && (
          <AppText color={colors.danger}>
            캐릭터를 불러오지 못했어요. 캐릭터를 숨기고 공유하거나 화면을 다시
            열어 주세요.
          </AppText>
        )}
        <View style={styles.disclosure}>
          <AppText variant="subheading">게시물</AppText>
          <View style={styles.field}>
            <AppText variant="label" color={colors.textMuted}>
              내용
            </AppText>
            <TextInput
              accessibilityLabel="게시물 내용"
              value={content}
              onChangeText={setContent}
              editable={!busy}
              multiline
              maxLength={MAX_CONTENT_LENGTH}
              placeholder="오늘 달리기는 어땠나요?"
              placeholderTextColor={colors.textSubtle}
              style={[styles.input, styles.contentInput]}
            />
          </View>
          <View style={styles.field}>
            <AppText variant="label" color={colors.textMuted}>
              태그
            </AppText>
            <TextInput
              accessibilityLabel="태그"
              value={tags}
              onChangeText={setTags}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={MAX_TAG_INPUT_LENGTH}
              placeholder="#오운완 #달료런"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
            />
          </View>
          <DisclosureRow
            title="위치 공개"
            detail={
              locationLoading
                ? '위치를 확인하는 중이에요'
                : location ?? '공개할 위치 정보가 없어요'
            }
            value={shareLocation && !!location}
            disabled={busy || !location}
            onChange={setShareLocation}
          />
        </View>
        <Button
          label={busy ? '준비 중…' : posted ? '피드에 올렸어요' : '피드에 게시'}
          disabled={busy || !cardReady || posted}
          onPress={post}
        />
        <AppText variant="caption" color={colors.textMuted}>
          피드에 게시하면 완성된 카드 이미지가 전체 공개로 올라가요.
        </AppText>
      </ScrollView>
      <PhotoSourceSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCamera={() => select(true)}
        onAlbum={() => select(false)}
        onRemove={
          photo
            ? () => {
                setPhoto(null);
                setPhotoReady(true);
              }
            : undefined
        }
      />
    </SafeAreaView>
  );
}
function DisclosureRow({
  title,
  detail,
  value,
  disabled,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.disclosureRow}>
      <View style={styles.disclosureText}>
        <AppText variant="body">{title}</AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
          {detail}
        </AppText>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.sm,
  },
  headerTitle: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },
  // 배경(연한 하늘색)과 대비되도록 거의 흰색 몸체에 옅은 회청색 테두리와 그림자를 둔다.
  // 홈 버튼은 몸체보다 밝은 흰색에 그림자를 줘서 눌린 것이 아니라 앞으로 튀어나온 느낌을 낸다
  phone: {
    backgroundColor: '#F9FBFB',
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: '#C3D3D3',
    paddingHorizontal: 12,
    ...shadow.floating,
  },
  phoneTop: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  sensor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D3DEDE',
  },
  speaker: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D3DEDE',
  },
  // 모서리를 둥글게 하면 jpg로 저장할 때 모서리가 검게 찍혀서 옛 아이폰 화면처럼 각지게 둔다
  card: {
    aspectRatio: 4 / 5,
    backgroundColor: '#178d7c',
    overflow: 'hidden',
  },
  background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,30,25,0.22)',
  },
  brand: { position: 'absolute', left: 24, top: 24 },
  character: {
    width: '45%',
    height: '45%',
    position: 'absolute',
    bottom: '20%',
  },
  right: { right: 8 },
  left: { left: 8 },
  stats: { position: 'absolute', left: 24, bottom: 38, right: 24, gap: 6 },
  white: { color: '#fff' },
  watermark: { position: 'absolute', bottom: 14, right: 18, color: '#fff' },
  phoneBottom: {
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: '#DCE5E5',
    backgroundColor: '#FCFEFE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F2A28',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  // 눌렀을 때는 몸체 쪽으로 들어가는 느낌이 나도록 그림자를 줄인다
  homePressed: {
    transform: [{ scale: 0.96 }],
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  disclosure: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  field: { gap: spacing.xs },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  contentInput: { minHeight: 96, textAlignVertical: 'top' },
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  disclosureText: { flex: 1, gap: 2 },
  homeDisabled: { opacity: 0.5 },
});
