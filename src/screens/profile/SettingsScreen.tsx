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
  Ban,
  Bell,
  Bookmark,
  Camera,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import type { Asset } from 'react-native-image-picker';
import { AppText, Button, IconButton } from '../../components/ui';
import { createTranslator } from '../../locales/translate';
import { SlideScreen } from '../../navigation/slide';
import { saveAccount } from '../../services/account.service';
import { signOut } from '../../services/auth.service';
import { choosePhoto, uploadPhoto } from '../../services/media.service';
import { requestPushPermission } from '../../services/notification.service';
import { runInBackground } from '../../services/backgroundTask.service';
import { saveThemePreference } from '../../services/themePreference.service';
import {
  colors,
  fonts,
  radius,
  setThemeMode,
  spacing,
  statusBarStyle,
  themedStyles,
  useThemeMode,
} from '../../theme';
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
import {
  areaKind,
  isDetailedRegion,
  REGION_AREAS,
  regionLabel,
  splitRegion,
} from '../../utils/regions';
import { normalizeUserId } from '../../utils/userId';

type Props = {
  user: UserDocument;
  onBack: () => void;
  onPreviewCharacter?: () => void;
  // 있으면 목록에 "저장한 게시물"을 보여 주고, 누르면 커뮤니티의 저장한 게시물로 간다
  onOpenSaved?: () => void;
  // 있으면 목록에 "차단한 사용자"를 보여 준다
  onOpenBlocked?: () => void;
  // 이 항목의 화면으로 바로 들어온다. 목록을 거치지 않으므로 뒤로 가면 설정을 닫고 왔던 화면으로 돌아간다
  initialSection?: 'profile';
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
const PREFERENCE_SECTIONS = ['notifications', 'region', 'dialect'] as const;
const PROFILE_KEYS = [
  'displayName',
  'userId',
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

export function SettingsScreen({
  user,
  onBack,
  onPreviewCharacter,
  onOpenSaved,
  onOpenBlocked,
  initialSection,
}: Props) {
  const insets = useSafeAreaInsets();
  const [initial, setInitial] = useState<ProfileForm>(() => ({
    displayName: user.display_name,
    userId: user.user_id ?? '',
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
  const [section, setSection] = useState<Section | null>(
    initialSection ?? null,
  );

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
      // 지역을 바꿀 때는 시·도 아래(광역시는 구·군, 도는 시·군)까지 골라야 한다
      if (form.region !== initial.region && !isDetailedRegion(form.region))
        throw new Error(
          `${areaKind(splitRegion(form.region).province)}까지 골라 주세요.`,
        );
      if (initial.userId && !normalizeUserId(form.userId ?? ''))
        throw new Error('아이디는 비울 수 없어요. 다른 아이디로 바꿔 주세요.');
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
        userId: normalizeUserId(form.userId ?? ''),
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
            label="아이디"
            value={form.userId ?? ''}
            onChangeText={value => change('userId', value.toLowerCase())}
            editable={!busy}
            placeholder="영문 소문자·숫자·_ 4~20자"
            maxLength={21}
          />
          <AppText variant="caption" color={colors.textMuted}>
            내 프로필 맨 위에 @아이디로 보여요. 다른 사람과 겹칠 수 없어요.
          </AppText>
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
            <View
              key={key}
              style={[styles.switchRow, key === 'push' && styles.masterSwitch]}
            >
              <AppText
                variant="subheading"
                color={
                  key !== 'push' && !notifications.push
                    ? colors.textMuted
                    : colors.text
                }
                style={styles.flex}
              >
                {label}
              </AppText>
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
          <AppText
            variant="caption"
            color={colors.textMuted}
            style={styles.fieldLabel}
          >
            앱 안의 알림 목록은 푸시 설정과 관계없이 확인할 수 있어요.
          </AppText>
        </>
      );
    if (target === 'region') {
      // 시·도를 고르면 그 아래 시·군·구가 나온다. 세종은 아래 단위가 없다
      const { province, area } = splitRegion(form.region);
      const areas = REGION_AREAS[province] ?? [];
      return (
        <>
          <View style={styles.options}>
            {REGIONS.map(region => (
              <Choice
                key={region}
                label={region}
                selected={province === region}
                disabled={!!busy}
                onPress={() =>
                  change('region', region === province ? form.region : region)
                }
              />
            ))}
          </View>
          {areas.length > 0 && (
            <>
              <AppText
                variant="subheading"
                accessibilityRole="header"
                style={styles.areaHeading}
              >
                {`${province} ${areaKind(province)}`}
              </AppText>
              <View style={styles.options}>
                {areas.map(item => (
                  <Choice
                    key={item}
                    label={item}
                    selected={area === item}
                    disabled={!!busy}
                    onPress={() =>
                      change('region', regionLabel(province, item))
                    }
                  />
                ))}
              </View>
            </>
          )}
        </>
      );
    }
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
    // 예전에 시·도만 저장한 지역은 아래 단위를 고르도록 알린다
    region: isDetailedRegion(initial.region)
      ? initial.region
      : `${initial.region} · ${areaKind(
          splitRegion(initial.region).province,
        )}을 골라 주세요`,
    dialect:
      DIALECT_OPTIONS.find(option => option.value === initial.dialect)?.label ??
      '',
  };

  const sectionPage = (target: Section, back: () => void) => (
    <SectionPage
      title={SECTION_TITLE[target]}
      insetsBottom={insets.bottom}
      dirty={changed[target]}
      busy={busy}
      progress={progress}
      uploading={target === 'profile' && !!photo}
      error={error}
      onDiscard={() => reset(target)}
      onBack={back}
      onSave={async () => {
        if (await save()) back();
      }}
    >
      {content(target)}
    </SectionPage>
  );
  // 다른 화면에서 항목으로 바로 들어온 경우: 목록을 거치지 않았으니 뒤로 가면 설정 전체를 닫고 왔던 화면으로 돌아간다
  if (initialSection)
    return (
      <View style={styles.screen}>{sectionPage(initialSection, onBack)}</View>
    );
  return (
    <View style={styles.screen}>
      <List
        insetsBottom={insets.bottom}
        busy={!!busy}
        error={section ? null : error}
        saved={saved}
        summary={summary}
        profileName={initial.displayName}
        petName={initialPetName}
        profileImage={initialImage}
        onOpen={open}
        onBack={onBack}
        onSignOut={requestSignOut}
        onPreviewCharacter={onPreviewCharacter}
        onOpenSaved={onOpenSaved}
        onOpenBlocked={onOpenBlocked}
      />
      {section && (
        <SlideScreen key={section} onBack={() => setSection(null)}>
          {back => sectionPage(section, back)}
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
  profileName,
  petName,
  profileImage,
  onOpen,
  onBack,
  onSignOut,
  onPreviewCharacter,
  onOpenSaved,
  onOpenBlocked,
}: {
  insetsBottom: number;
  busy: boolean;
  error: string | null;
  saved: boolean;
  summary: Record<Section, string>;
  profileName: string;
  petName: string;
  profileImage: string | null;
  onOpen: (section: Section) => void;
  onBack: () => void;
  onSignOut: () => void;
  onPreviewCharacter?: () => void;
  onOpenSaved?: () => void;
  onOpenBlocked?: () => void;
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
      <StatusBar
        barStyle={statusBarStyle()}
        backgroundColor={colors.background}
      />
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`내 프로필, ${summary.profile}`}
          disabled={busy}
          onPress={() => onOpen('profile')}
          style={({ pressed }) => [
            styles.profileEntry,
            pressed && styles.profilePressed,
          ]}
        >
          {profileImage ? (
            <Image
              source={{ uri: profileImage }}
              style={styles.profileAvatar}
            />
          ) : (
            <View style={[styles.profileAvatar, styles.photoPlaceholder]}>
              <UserRound color={colors.primaryInk} size={25} />
            </View>
          )}
          <View style={styles.flex}>
            <AppText variant="label" color={colors.primaryInk}>
              내 프로필
            </AppText>
            <AppText variant="heading" numberOfLines={1}>
              {profileName}
            </AppText>
            <AppText
              variant="caption"
              color={colors.textMuted}
              numberOfLines={1}
            >
              캐릭터 · {petName}
            </AppText>
          </View>
          <ChevronRight color={colors.primaryInk} size={20} />
        </Pressable>
        <View style={styles.listGroup}>
          <AppText
            variant="label"
            color={colors.textMuted}
            accessibilityRole="header"
            style={styles.groupTitle}
          >
            앱 환경
          </AppText>
          {PREFERENCE_SECTIONS.map(item => (
            <SettingsRow
              key={item}
              icon={SECTION_ICON[item]}
              label={SECTION_TITLE[item]}
              value={summary[item]}
              active={item === 'notifications' && summary[item] === '켜짐'}
              disabled={busy}
              onPress={() => onOpen(item)}
            />
          ))}
          <DarkModeRow />
        </View>
        {(onOpenSaved || onOpenBlocked) && (
          <View style={styles.listGroup}>
            <AppText
              variant="label"
              color={colors.textMuted}
              accessibilityRole="header"
              style={styles.groupTitle}
            >
              커뮤니티
            </AppText>
            {onOpenSaved && (
              <SettingsRow
                icon={Bookmark}
                label="저장한 게시물"
                disabled={busy}
                onPress={onOpenSaved}
              />
            )}
            {onOpenBlocked && (
              <SettingsRow
                icon={Ban}
                label="차단한 사용자"
                disabled={busy}
                onPress={onOpenBlocked}
              />
            )}
          </View>
        )}
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
        <View style={styles.listGroup}>
          <AppText
            variant="label"
            color={colors.textMuted}
            accessibilityRole="header"
            style={styles.groupTitle}
          >
            계정
          </AppText>
          <SettingsRow
            icon={LogOut}
            label="로그아웃"
            danger
            disabled={busy}
            onPress={onSignOut}
          />
        </View>
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

// 다크 모드 켜고 끄기. 누르는 즉시 앱 전체 색이 바뀌고, 이 기기에 저장한다(계정 설정과 따로 저장 버튼이 없다)
function DarkModeRow() {
  const dark = useThemeMode() === 'dark';
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setThemeMode(next);
    runInBackground({
      label: '다크 모드 저장 중',
      failureLabel: '다크 모드 설정을 저장하지 못했어요',
      describeError: () =>
        '지금은 바뀐 테마로 쓰고, 다음에 앱을 열면 이전 테마로 시작해요.',
      silent: true,
      retryable: false,
      task: () => saveThemePreference(next),
    });
  };
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="다크 모드"
      accessibilityState={{ checked: dark }}
      onPress={toggle}
      style={({ pressed }) => [styles.listRow, pressed && styles.listPressed]}
    >
      <Moon color={colors.primaryInk} size={20} strokeWidth={1.8} />
      <AppText variant="subheading" color={colors.text} style={styles.flex}>
        다크 모드
      </AppText>
      <Switch
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        value={dark}
        onValueChange={toggle}
        trackColor={{ false: colors.border, true: colors.primary }}
        ios_backgroundColor={colors.border}
      />
    </Pressable>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  active,
  danger,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  active?: boolean;
  danger?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.listPressed]}
    >
      <Icon
        color={danger ? colors.danger : colors.primaryInk}
        size={20}
        strokeWidth={1.8}
      />
      <AppText variant="subheading" color={tint} style={styles.flex}>
        {label}
      </AppText>
      {!!value && (
        <AppText
          variant="caption"
          color={active ? colors.primaryInk : colors.textMuted}
          style={styles.rowValue}
          numberOfLines={1}
        >
          {value}
        </AppText>
      )}
      {!danger && <ChevronRight color={colors.textSubtle} size={16} />}
    </Pressable>
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
            { paddingBottom: spacing.xxl },
          ]}
        >
          <View style={styles.detailFields}>{children}</View>
        </ScrollView>
        <View
          style={[styles.saveBar, { paddingBottom: insetsBottom + spacing.sm }]}
        >
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
          />
        </View>
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
const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  spacer: { width: 44 },
  content: { paddingHorizontal: spacing.xl },
  // 내 프로필 영역. 둥근 상자 대신 본문 좌우 여백(spacing.xl)을 상쇄해 화면 양끝까지 채운 띠로 둔다
  profileEntry: {
    marginTop: spacing.lg,
    marginHorizontal: -spacing.xl,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 96,
  },
  profilePressed: { backgroundColor: colors.primaryBorder },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
  },
  listGroup: { marginTop: spacing.xxl },
  groupTitle: { marginBottom: spacing.xs },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 54,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  listPressed: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
  },
  rowValue: { maxWidth: '42%', flexShrink: 1 },
  detailFields: { marginTop: spacing.md },
  saveBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
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
  areaHeading: { marginTop: spacing.xl },
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
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  masterSwitch: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
}));
