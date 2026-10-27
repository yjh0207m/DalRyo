import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import NativeShare from 'react-native-share';
import type { Asset } from 'react-native-image-picker';
import { AppText, Button, IconButton } from '../../components/ui';
import { choosePhoto } from '../../services/media.service';
import { fetchCharacterImageUrl } from '../../services/character.service';
import type { CharacterDocument } from '../../types/character.types';
import type { RunDocument } from '../../types/run.types';
import { formatDuration, formatPace } from '../../utils/pace';
import { colors, spacing } from '../../theme';

type Props = {
  character: CharacterDocument | null;
  run?: RunDocument;
  onBack: () => void;
};
export function ShareStudioScreen({ character, run, onBack }: Props) {
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
  const share = async () => {
    if (
      lock.current ||
      !photoReady ||
      (showCharacter && character && !characterReady)
    )
      return;
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
        <AppText variant="heading">오운완 카드</AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
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
        <View style={styles.row}>
          <Button
            label="앨범"
            size="md"
            variant="secondary"
            disabled={busy}
            onPress={() => select(false)}
            style={styles.grow}
          />
          <Button
            label="사진 촬영"
            size="md"
            variant="secondary"
            disabled={busy}
            onPress={() => select(true)}
            style={styles.grow}
          />
        </View>
        {photo && (
          <Button
            label="사진 지우기"
            size="md"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setPhoto(null);
              setPhotoReady(true);
            }}
          />
        )}
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
        <Button
          label={busy ? '준비 중…' : '이미지 공유'}
          disabled={
            busy ||
            !photoReady ||
            !!(showCharacter && character && !characterReady)
          }
          onPress={share}
        />
        <AppText variant="caption" color={colors.textMuted}>
          사진은 공유 카드에만 사용해요. 공유할 앱은 다음 화면에서 직접 선택할
          수 있어요.
        </AppText>
      </ScrollView>
    </SafeAreaView>
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
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },
  card: {
    aspectRatio: 4 / 5,
    backgroundColor: '#178d7c',
    overflow: 'hidden',
    borderRadius: 20,
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
  row: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1 },
});
