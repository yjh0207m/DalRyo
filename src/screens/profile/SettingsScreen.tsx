import {createTranslator} from '../../locales/translate';
import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Camera, ChevronLeft, LogOut, UserRound} from 'lucide-react-native';
import {AppText, Button, Card, IconButton} from '../../components/ui';
import {saveAccount} from '../../services/account.service';
import {choosePhoto, uploadPhoto} from '../../services/media.service';
import {requestPushPermission} from '../../services/notification.service';
import type {Asset} from 'react-native-image-picker';
import {signOut} from '../../services/auth.service';
import {colors, fonts, radius, spacing} from '../../theme';
import {DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences, type UserDocument} from '../../types/user.types';
import {DIALECT_OPTIONS, normalizeDialect, REGIONS, validateProfile, type ProfileForm} from '../../utils/profile';

type Props = {user: UserDocument; onBack: () => void};

export function SettingsScreen({user, onBack}: Props) {
  const insets = useSafeAreaInsets();
  const [initial, setInitial] = useState<ProfileForm>(() => ({
    displayName: user.display_name,
    website: user.website ?? '',
    height: user.height_cm?.toString() ?? '',
    weight: user.weight_kg?.toString() ?? '',
    gender: user.gender,
    region: user.region,
    dialect: normalizeDialect(user.dialect),
  }));
  const [form, setForm] = useState(initial);
  const [initialPetName, setInitialPetName] = useState(user.pet_name);
  const [petName, setPetName] = useState(user.pet_name);
  const [initialImage, setInitialImage] = useState(user.profile_image);
  const [photo, setPhoto] = useState<Asset | null | undefined>(undefined);
  const [initialNotifications, setInitialNotifications] = useState<NotificationPreferences>(() => ({...DEFAULT_NOTIFICATION_PREFERENCES, ...user.notification_settings}));
  const [notifications, setNotifications] = useState(initialNotifications);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState<'save' | 'logout' | 'select' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(initial) !== JSON.stringify(form) || petName !== initialPetName || photo !== undefined || JSON.stringify(initialNotifications) !== JSON.stringify(notifications);
  const photoUri = photo === undefined ? initialImage : photo?.uri;
  const change = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm(previous => ({...previous, [key]: value}));
    setError(null);
    setSaved(false);
  };
  const leave = useCallback(() => {
    if (busy) return;
    if (!dirty) {
      onBack();
      return;
    }
    Alert.alert('변경 내용을 저장하지 않았어요', '저장하지 않고 나갈까요?', [
      {text: '계속 수정', style: 'cancel'},
      {text: '나가기', style: 'destructive', onPress: onBack},
    ]);
  }, [busy, dirty, onBack]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => subscription.remove();
  }, [leave]);
  const save = async () => {
    if (busy) return;
    try {
      validateProfile(form);
      if (!petName.trim() || petName.trim().length > 20) throw new Error('캐릭터 이름은 1~20자로 입력해 주세요.');
      setBusy('save');
      setError(null);
      if (notifications.push && !initialNotifications.push && !await requestPushPermission()) throw new Error('기기 설정에서 달료 알림을 허용해 주세요.');
      setProgress(0);
      const uploaded = photo ? await uploadPhoto(photo, 'profiles', setProgress) : null;
      const imageUrl = photo === null ? null : uploaded?.url ?? initialImage;
      await saveAccount(form, petName, imageUrl, notifications);
      const next = {...form, displayName: form.displayName.trim(), website: form.website.trim()};
      setInitial(next);
      setForm(next);
      setInitialPetName(petName.trim());
      setPetName(petName.trim());
      setInitialImage(imageUrl);
      setPhoto(undefined);
      setInitialNotifications(notifications);
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error && !('code' in failure) ? failure.message : '저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.',
      );
    } finally {
      setBusy(null);
    }
  };
  const selectPhoto = async (camera: boolean) => {
    if (busy) return;
    setBusy('select');
    setError(null);
    try {
      const selected = await choosePhoto(camera);
      if (selected) {setPhoto(selected); setSaved(false);}
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '사진을 불러오지 못했어요.');
    } finally {setBusy(null);}
  };
  const openPhotoMenu = () => Alert.alert('프로필 사진', '사진을 선택해 주세요.', [
    {text: '앨범에서 선택', onPress: () => selectPhoto(false)},
    {text: '사진 촬영', onPress: () => selectPhoto(true)},
    {text: '기본 사진으로', onPress: () => {setPhoto(null); setSaved(false);}},
    {text: '취소', style: 'cancel'},
  ]);
  const requestSignOut = () => {
    Alert.alert('로그아웃할까요?', dirty ? '저장하지 않은 변경 내용은 사라져요.' : '다시 이용하려면 휴대폰 인증으로 로그인해 주세요.', [
      {text: '취소', style: 'cancel'},
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          setBusy('logout');
          setError(null);
          try {
            await signOut();
          } catch {
            setBusy(null);
            setError('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.');
          }
        },
      },
    ]);
  };
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} variant="plain" accessibilityLabel="설정에서 뒤로" onPress={leave} />
          <AppText variant="heading">설정</AppText>
          <View style={styles.spacer} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + spacing.xxxl}]}
        >
          <Card style={styles.section}>
            <AppText variant="subheading">내 프로필</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="프로필 사진 변경" disabled={!!busy} onPress={openPhotoMenu} style={styles.photoRow}>
              {photoUri ? <Image source={{uri: photoUri}} style={styles.photo} /> : <View style={[styles.photo, styles.photoPlaceholder]}><UserRound color={colors.primaryInk} size={30} /></View>}
              <Camera color={colors.primaryInk} size={20} /><AppText variant="caption" color={colors.primaryInk}>사진 변경</AppText>
            </Pressable>
            <Field label="캐릭터 이름" value={petName} onChangeText={value => {setPetName(value); setSaved(false); setError(null);}} editable={!busy} maxLength={20} />
            <Field
              label="닉네임"
              value={form.displayName}
              onChangeText={value => change('displayName', value)}
              editable={!busy}
              maxLength={20}
            />
            <Field
              label="웹사이트 (선택)"
              value={form.website}
              onChangeText={value => change('website', value)}
              editable={!busy}
              keyboardType="url"
              placeholder="https://"
              maxLength={500}
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Field
                  label="키 · cm (선택)"
                  value={form.height}
                  onChangeText={value => change('height', value)}
                  editable={!busy}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
              </View>
              <View style={styles.flex}>
                <Field
                  label="몸무게 · kg (선택)"
                  value={form.weight}
                  onChangeText={value => change('weight', value)}
                  editable={!busy}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
              </View>
            </View>
            <AppText variant="caption" color={colors.textMuted} style={styles.fieldLabel}>
              몸무게는 달리기 칼로리 계산에 사용돼요.
            </AppText>
            <AppText variant="caption" style={styles.fieldLabel}>
              성별 (선택)
            </AppText>
            <View style={styles.options}>
              {(
                [
                  {value: null, label: '선택 안 함'},
                  {value: 'female', label: '여성'},
                  {value: 'male', label: '남성'},
                ] as const
              ).map(option => (
                <Choice
                  key={option.label}
                  label={option.label}
                  selected={form.gender === option.value}
                  disabled={!!busy}
                  onPress={() => change('gender', option.value)}
                />
              ))}
            </View>
          </Card>
          <Card style={styles.section}>
            <AppText variant="subheading">푸시 알림</AppText>
            {([
              ['push', '푸시 알림 받기'], ['growth', '캐릭터 성장'], ['social', '응원·댓글·팔로우'], ['stone', '달리기 리마인더'],
            ] as Array<[keyof NotificationPreferences, string]>).map(([key, label]) => (
              <View key={key} style={styles.switchRow}>
                <AppText>{label}</AppText>
                <Switch accessibilityLabel={label} value={notifications[key]} disabled={!!busy || (key !== 'push' && !notifications.push)} onValueChange={value => {setNotifications(previous => ({...previous, [key]: value})); setSaved(false);}} trackColor={{true: colors.primary}} />
              </View>
            ))}
            <AppText variant="caption" color={colors.textMuted}>앱 안의 알림 목록은 푸시 설정과 관계없이 확인할 수 있어요.</AppText>
          </Card>
          <Card style={styles.section}>
            <AppText variant="subheading">내 지역</AppText>
            <View style={styles.options}>
              {REGIONS.map(region => (
                <Choice
                  key={region}
                  label={region}
                  selected={form.region === region}
                  disabled={!!busy}
                  onPress={() => change('region', region)}
                />
              ))}
            </View>
          </Card>
          <Card style={styles.section}>
            <AppText variant="subheading">달료 말투</AppText>
            <View style={styles.options}>
              {DIALECT_OPTIONS.map(option => (
                <Choice
                  key={option.value}
                  label={option.label}
                  selected={form.dialect === option.value}
                  disabled={!!busy}
                  onPress={() => change('dialect', option.value)}
                />
              ))}
            </View>
            <AppText variant="caption" color={colors.primaryInk} style={styles.fieldLabel}>
              {createTranslator(form.dialect)('home.hello')}
            </AppText>
          </Card>
          {error && (
            <AppText variant="caption" color={colors.danger} accessibilityRole="alert" style={styles.message}>
              {error}
            </AppText>
          )}
          {saved && (
            <AppText variant="caption" color={colors.primaryInk} accessibilityLiveRegion="polite" style={styles.message}>
              설정을 저장했어요.
            </AppText>
          )}
          {busy && <ActivityIndicator color={colors.primary} style={styles.message} />}
          {busy === 'save' && photo && <AppText variant="caption" align="center">사진 업로드 {progress}%</AppText>}
          <Button
            label={busy === 'save' ? '저장 중…' : '변경 내용 저장'}
            onPress={save}
            disabled={!!busy || !dirty}
            style={styles.section}
          />
          <Button label="로그아웃" icon={LogOut} variant="ghost" onPress={requestSignOut} disabled={!!busy} style={styles.section} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({label, ...props}: React.ComponentProps<typeof TextInput> & {label: string}) {
  return (
    <View style={styles.field}>
      <AppText variant="caption">{label}</AppText>
      <TextInput
        {...props}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
      />
    </View>
  );
}
function Choice({label, selected, disabled, onPress}: {label: string; selected: boolean; disabled: boolean; onPress: () => void}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{selected, disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected && styles.selectedChoice]}
    >
      <AppText variant="caption" color={selected ? colors.primaryInk : colors.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg},
  spacer: {width: 44},
  content: {paddingHorizontal: spacing.xl},
  section: {marginTop: spacing.lg},
  field: {marginTop: spacing.lg, gap: spacing.sm},
  fieldLabel: {marginTop: spacing.md},
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  row: {flexDirection: 'row', gap: spacing.md},
  flex: {flex: 1},
  options: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md},
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  selectedChoice: {backgroundColor: colors.primarySoft, borderColor: colors.primary},
  message: {marginTop: spacing.lg},
  photoRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg},
  photo: {width: 72, height: 72, borderRadius: 36},
  photoPlaceholder: {backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center'},
  switchRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52},
});
