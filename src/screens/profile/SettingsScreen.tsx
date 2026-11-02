import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MapPin,
  MessageCircle,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import type { Asset } from 'react-native-image-picker';
import { AppText, Button, Card, IconButton } from '../../components/ui';
import { createTranslator } from '../../locales/translate';
import { SlideScreen } from '../../navigation/slide';
import { saveAccount } from '../../services/account.service';
import { signOut } from '../../services/auth.service';
import { choosePhoto, uploadPhoto } from '../../services/media.service';
import { requestPushPermission } from '../../services/notification.service';
import { colors, fonts, radius, spacing } from '../../theme';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type UserDocument,
} from '../../types/user.types';
import {
  DIALECT_OPTIONS,
  normalizeDialect,
  REGIONS,
  validateProfile,
  type ProfileForm,
} from '../../utils/profile';

type Props = {
  user: UserDocument;
  onBack: () => void;
  onPreviewCharacter?: () => void;
};

// 설정 목록의 항목. 항목을 누르면 그 항목만 바꾸는 화면이 밀려 들어온다
type Section = 'profile' | 'notifications' | 'region' | 'dialect';
const SECTION_TITLE: Record<Section, string> = {
  profile: '내 프로필',
  notifications: '푸시 알림',
  region: '내 지역',
  dialect: '달료 말투',
};
const SECTION_ICON: Record<Section, LucideIcon> = {
  profile: UserRound,
  notifications: Bell,
  region: MapPin,
  dialect: MessageCircle,
};
const SECTIONS: Section[] = ['profile', 'notifications', 'region', 'dialect'];
const PROFILE_KEYS = [
  'displayName',
  'website',
  'height',
  'weight',
  'gender',
] as const;
const NOTIFICATION_LABELS: Array<[keyof NotificationPreferences, string]> = [
  ['push', '푸시 알림 받기'],
  ['growth', '캐릭터 성장'],
  ['social', '응원·댓글·팔로우'],
  ['stone', '달리기 리마인더'],
];

export function SettingsScreen({ user, onBack, onPreviewCharacter }: Props) {
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
  const [initialNotifications, setInitialNotifications] =
    useState<NotificationPreferences>(() => ({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...user.notification_settings,
    }));
  const [notifications, setNotifications] = useState(initialNotifications);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState<'save' | 'logout' | 'select' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState<Section | null>(null);

  const photoUri = photo === undefined ? initialImage : photo?.uri;
  // 항목별로 바뀐 것이 있는지. 상세 화면은 자기 항목만 보고, 나갈 때 자기 항목만 되돌린다
  const changed: Record<Section, boolean> = {
    profile:
      petName !== initialPetName ||
      photo !== undefined ||
      PROFILE_KEYS.some(key => form[key] !== initial[key]),
    notifications:
      JSON.stringify(initialNotifications) !== JSON.stringify(notifications),
    region: form.region !== initial.region,
    dialect: form.dialect !== initial.dialect,
  };
  const reset = (target: Section) => {
    if (target === 'profile') {
      setForm(previous => ({
        ...previous,
        ...Object.fromEntries(PROFILE_KEYS.map(key => [key, initial[key]])),
      }));
      setPetName(initialPetName);
      setPhoto(undefined);
    } else if (target === 'notifications')
      setNotifications(initialNotifications);
    else if (target === 'region')
      setForm(previous => ({ ...previous, region: initial.region }));
    else setForm(previous => ({ ...previous, dialect: initial.dialect }));
    setError(null);
  };
  const change = <K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K],
  ) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setError(null);
    setSaved(false);
  };
  const open = (target: Section) => {
    if (busy) return;
    setError(null);
    setSaved(false);
    setSection(target);
  };

  // 현재 값으로 서버에 저장한다. 성공하면 true
  const save = async () => {
    if (busy) return false;
    try {
      validateProfile(form);
      if (!petName.trim() || petName.trim().length > 20)
        throw new Error('캐릭터 이름은 1~20자로 입력해 주세요.');
      setBusy('save');
      setError(null);
      if (
        notifications.push &&
        !initialNotifications.push &&
        !(await requestPushPermission())
      )
        throw new Error('기기 설정에서 달료 알림을 허용해 주세요.');
      setProgress(0);
      const uploaded = photo
        ? await uploadPhoto(photo, 'profiles', setProgress)
        : null;
      const imageUrl = photo === null ? null : uploaded?.url ?? initialImage;
      await saveAccount(form, petName, imageUrl, notifications);
      const next = {
        ...form,
        displayName: form.displayName.trim(),
        website: form.website.trim(),
      };
      setInitial(next);
      setForm(next);
      setInitialPetName(petName.trim());
      setPetName(petName.trim());
      setInitialImage(imageUrl);
      setPhoto(undefined);
      setInitialNotifications(notifications);
      setSaved(true);
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error && !('code' in failure)
          ? failure.message
          : '저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.',
      );
      return false;
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
      if (selected) {
        setPhoto(selected);
        setSaved(false);
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : '사진을 불러오지 못했어요.',
      );
    } finally {
      setBusy(null);
    }
  };
  const openPhotoMenu = () =>
    Alert.alert('프로필 사진', '사진을 선택해 주세요.', [
      { text: '앨범에서 선택', onPress: () => selectPhoto(false) },
      { text: '사진 촬영', onPress: () => selectPhoto(true) },
      {
        text: '기본 사진으로',
        onPress: () => {
          setPhoto(null);
          setSaved(false);
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  const requestSignOut = () => {
    Alert.alert(
      '로그아웃할까요?',
      '다시 이용하려면 휴대폰 인증으로 로그인해 주세요.',
      [
        { text: '취소', style: 'cancel' },
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
      ],
    );
  };

  // 항목별 상세 화면의 내용
  const content = (target: Section) => {
    if (target === 'profile')
      return (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로필 사진 변경"
            disabled={!!busy}
            onPress={openPhotoMenu}
            style={styles.photoRow}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <UserRound color={colors.primaryInk} size={30} />
              </View>
            )}
            <Camera color={colors.primaryInk} size={20} />
            <AppText variant="caption" color={colors.primaryInk}>
              사진 변경
            </AppText>
          </Pressable>
          <Field
            label="캐릭터 이름"
            value={petName}
            onChangeText={value => {
              setPetName(value);
              setSaved(false);
              setError(null);
            }}
            editable={!busy}
            maxLength={20}
          />
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
          <AppText
            variant="caption"
            color={colors.textMuted}
            style={styles.fieldLabel}
          >
            몸무게는 달리기 칼로리 계산에 사용돼요.
          </AppText>
          <AppText variant="caption" style={styles.fieldLabel}>
            성별 (선택)
          </AppText>
          <View style={styles.options}>
            {(
              [
                { value: null, label: '선택 안 함' },
                { value: 'female', label: '여성' },
                { value: 'male', label: '남성' },
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
        </>
      );
    if (target === 'notifications')
      return (
        <>
          {NOTIFICATION_LABELS.map(([key, label]) => (
            <View key={key} style={styles.switchRow}>
              <AppText>{label}</AppText>
              <Switch
                accessibilityLabel={label}
                value={notifications[key]}
                disabled={!!busy || (key !== 'push' && !notifications.push)}
                onValueChange={value => {
                  setNotifications(previous => ({ ...previous, [key]: value }));
                  setSaved(false);
                  setError(null);
                }}
                trackColor={{ true: colors.primary }}
              />
            </View>
          ))}
          <AppText variant="caption" color={colors.textMuted}>
            앱 안의 알림 목록은 푸시 설정과 관계없이 확인할 수 있어요.
          </AppText>
        </>
      );
    if (target === 'region')
      return (
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
      );
    return (
      <>
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
        <AppText
          variant="caption"
          color={colors.primaryInk}
          style={styles.fieldLabel}
        >
          {createTranslator(form.dialect)('home.hello')}
        </AppText>
      </>
    );
  };

  // 목록에 보여 주는 현재(저장된) 값
  const summary: Record<Section, string> = {
    profile: `${initial.displayName} · ${initialPetName}`,
    notifications: initialNotifications.push ? '켜짐' : '꺼짐',
    region: initial.region,
    dialect:
      DIALECT_OPTIONS.find(option => option.value === initial.dialect)?.label ??
      '',
  };

  return (
    <View style={styles.screen}>
      <List
        insetsBottom={insets.bottom}
        busy={!!busy}
        error={section ? null : error}
        saved={saved}
        summary={summary}
        onOpen={open}
        onBack={onBack}
        onSignOut={requestSignOut}
        onPreviewCharacter={onPreviewCharacter}
      />
      {section && (
        <SlideScreen key={section} onBack={() => setSection(null)}>
          {back => (
            <SectionPage
              title={SECTION_TITLE[section]}
              insetsBottom={insets.bottom}
              dirty={changed[section]}
              busy={busy}
              progress={progress}
              uploading={section === 'profile' && !!photo}
              error={error}
              onDiscard={() => reset(section)}
              onBack={back}
              onSave={async () => {
                if (await save()) back();
              }}
            >
              {content(section)}
            </SectionPage>
          )}
        </SlideScreen>
      )}
    </View>
  );
}

// 설정 목록: 항목마다 현재 값을 보여 주고, 누르면 그 항목 화면으로 들어간다
function List({
  insetsBottom,
  busy,
  error,
  saved,
  summary,
  onOpen,
  onBack,
  onSignOut,
  onPreviewCharacter,
}: {
  insetsBottom: number;
  busy: boolean;
  error: string | null;
  saved: boolean;
  summary: Record<Section, string>;
  onOpen: (section: Section) => void;
  onBack: () => void;
  onSignOut: () => void;
  onPreviewCharacter?: () => void;
}) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onBack]);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <IconButton
          icon={ChevronLeft}
          variant="plain"
          accessibilityLabel="설정에서 뒤로"
          onPress={onBack}
        />
        <AppText variant="heading">설정</AppText>
        <View style={styles.spacer} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insetsBottom + spacing.xxxl },
        ]}
      >
        {saved && (
          <AppText
            variant="caption"
            color={colors.primaryInk}
            accessibilityLiveRegion="polite"
            style={styles.message}
          >
            설정을 저장했어요.
          </AppText>
        )}
        <Card style={styles.listCard} padded={false}>
          {SECTIONS.map((section, index) => {
            const Icon = SECTION_ICON[section];
            return (
              <Pressable
                key={section}
                accessibilityRole="button"
                accessibilityLabel={`${SECTION_TITLE[section]}, ${summary[section]}`}
                disabled={busy}
                onPress={() => onOpen(section)}
                style={({ pressed }) => [
                  styles.listRow,
                  index < SECTIONS.length - 1 && styles.listDivider,
                  pressed && styles.listPressed,
                ]}
              >
                <View style={styles.listIcon}>
                  <Icon color={colors.primaryInk} size={20} strokeWidth={2} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="subheading">
                    {SECTION_TITLE[section]}
                  </AppText>
                  <AppText
                    variant="caption"
                    color={colors.textMuted}
                    numberOfLines={1}
                  >
                    {summary[section]}
                  </AppText>
                </View>
                <ChevronRight color={colors.textSubtle} size={18} />
              </Pressable>
            );
          })}
        </Card>
        {error && (
          <AppText
            variant="caption"
            color={colors.danger}
            accessibilityRole="alert"
            style={styles.message}
          >
            {error}
          </AppText>
        )}
        {busy && (
          <ActivityIndicator color={colors.primary} style={styles.message} />
        )}
        <Button
          label="로그아웃"
          icon={LogOut}
          variant="ghost"
          onPress={onSignOut}
          disabled={busy}
          style={styles.section}
        />
        {__DEV__ && onPreviewCharacter && (
          <Button
            label="캐릭터 미리보기 (개발용)"
            variant="ghost"
            onPress={onPreviewCharacter}
            disabled={busy}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// 항목 하나를 바꾸는 화면. 저장하지 않고 나가면 확인을 받고, 나가면 바꾼 값은 되돌린다
function SectionPage({
  title,
  insetsBottom,
  dirty,
  busy,
  progress,
  uploading,
  error,
  onDiscard,
  onBack,
  onSave,
  children,
}: {
  title: string;
  insetsBottom: number;
  dirty: boolean;
  busy: 'save' | 'logout' | 'select' | null;
  progress: number;
  uploading: boolean;
  error: string | null;
  onDiscard: () => void;
  onBack: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  const leave = useCallback(() => {
    if (busy) return;
    if (!dirty) {
      onBack();
      return;
    }
    Alert.alert('변경 내용을 저장하지 않았어요', '저장하지 않고 나갈까요?', [
      { text: '계속 수정', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: () => {
          onDiscard();
          onBack();
        },
      },
    ]);
  }, [busy, dirty, onBack, onDiscard]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        leave();
        return true;
      },
    );
    return () => subscription.remove();
  }, [leave]);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <IconButton
            icon={ChevronLeft}
            variant="plain"
            accessibilityLabel={`${title}에서 뒤로`}
            onPress={leave}
          />
          <AppText variant="heading">{title}</AppText>
          <View style={styles.spacer} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insetsBottom + spacing.xxxl },
          ]}
        >
          <Card style={styles.section}>{children}</Card>
          {error && (
            <AppText
              variant="caption"
              color={colors.danger}
              accessibilityRole="alert"
              style={styles.message}
            >
              {error}
            </AppText>
          )}
          {busy && (
            <ActivityIndicator color={colors.primary} style={styles.message} />
          )}
          {busy === 'save' && uploading && (
            <AppText variant="caption" align="center">
              사진 업로드 {progress}%
            </AppText>
          )}
          <Button
            label={busy === 'save' ? '저장 중…' : '저장'}
            onPress={onSave}
            disabled={!!busy || !dirty}
            style={styles.section}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
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
function Choice({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected && styles.selectedChoice]}
    >
      <AppText
        variant="caption"
        color={selected ? colors.primaryInk : colors.textMuted}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  spacer: { width: 44 },
  content: { paddingHorizontal: spacing.xl },
  section: { marginTop: spacing.lg },
  listCard: { marginTop: spacing.lg, overflow: 'hidden' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  listDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listPressed: { backgroundColor: colors.surfaceMuted },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { marginTop: spacing.lg, gap: spacing.sm },
  fieldLabel: { marginTop: spacing.md },
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
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  selectedChoice: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  message: { marginTop: spacing.lg },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photo: { width: 72, height: 72, borderRadius: 36 },
  photoPlaceholder: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
});
