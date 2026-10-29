import {useDialect} from '../../locales/DialectProvider';
import React, {useState} from 'react';
import {Pressable, StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronLeft, Footprints, Minus, Plus} from 'lucide-react-native';
import {AppText, Button, IconButton} from '../../components/ui';
import {colors, fonts, radius, shadow, spacing} from '../../theme';
import type {RunGoalType} from '../../types/run.types';

type GoalSetting = Exclude<RunGoalType, 'free'>;

type Props = {
  goalType: GoalSetting;
  onBack: () => void;
  onStart: (value: number) => void;
};

type GoalConfig = {
  title: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  initial: number;
  presets: number[];
  // 목표를 체감하기 쉽게 보조 설명 (보통 페이스 6분/km 기준)
  hint: (value: number) => string;
};

const PACE_MIN_PER_KM = 6;

const CONFIG: Record<GoalSetting, GoalConfig> = {
  time: {
    title: '몇 분 달릴까요?',
    unit: '분',
    step: 5,
    min: 5,
    max: 180,
    initial: 30,
    presets: [10, 20, 30, 45, 60],
    hint: value => `보통 페이스면 약 ${(value / PACE_MIN_PER_KM).toFixed(1)}km예요`,
  },
  distance: {
    title: '몇 km 달릴까요?',
    unit: 'km',
    step: 0.5,
    min: 0.5,
    max: 42.2,
    initial: 3,
    presets: [1, 3, 5, 10],
    hint: value => `보통 페이스면 약 ${Math.round(value * PACE_MIN_PER_KM)}분 걸려요`,
  },
  calorie: {
    title: '얼마나 태울까요?',
    unit: 'kcal',
    step: 50,
    min: 50,
    max: 1500,
    initial: 200,
    presets: [100, 200, 300, 500],
    hint: value => `60kg 기준 약 ${(value / 62).toFixed(1)}km 정도예요`,
  },
};

// 목표 값 하나만 크게 보여 주고 ± 와 자주 쓰는 값으로 고른다 (Figma: "한눈에 봐도 간단하게")
export function GoalValueScreen({goalType, onBack, onStart}: Props) {
  const insets = useSafeAreaInsets();
  const t = useDialect();
  const config = CONFIG[goalType];
  const [value, setValue] = useState(config.initial);

  const change = (delta: number) => {
    setValue(current => Math.min(config.max, Math.max(config.min, Math.round((current + delta) * 10) / 10)));
  };

  return (
    <View style={[styles.screen, {paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl}]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} variant="plain" accessibilityLabel="뒤로" onPress={onBack} />
      </View>
      <AppText variant="title">{config.title}</AppText>

      <View style={styles.valueBlock}>
        <View style={styles.stepperRow}>
          <StepButton icon="minus" disabled={value <= config.min} onPress={() => change(-config.step)} />
          <View style={styles.valueWrap}>
            <AppText style={styles.value} align="center">
              {formatValue(value)}
            </AppText>
            <AppText variant="subheading" color={colors.textMuted} align="center">
              {config.unit}
            </AppText>
          </View>
          <StepButton icon="plus" disabled={value >= config.max} onPress={() => change(config.step)} />
        </View>
        <AppText variant="caption" color={colors.textMuted} align="center">
          {config.hint(value)}
        </AppText>
      </View>

      <View style={styles.presets}>
        {config.presets.map(preset => {
          const active = preset === value;
          return (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              onPress={() => setValue(preset)}
              style={[styles.preset, active && styles.presetActive]}
            >
              <AppText variant="subheading" color={active ? colors.textOnPrimary : colors.text}>
                {formatValue(preset)}
                {config.unit}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Button label={t('run.goalStart')} icon={Footprints} onPress={() => onStart(value)} />
    </View>
  );
}

function StepButton({icon, disabled, onPress}: {icon: 'minus' | 'plus'; disabled: boolean; onPress: () => void}) {
  const Icon = icon === 'minus' ? Minus : Plus;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon === 'minus' ? '줄이기' : '늘리기'}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [styles.step, pressed && styles.stepPressed, disabled && styles.stepDisabled]}
    >
      <Icon color={colors.primaryInk} size={26} strokeWidth={2.4} />
    </Pressable>
  );
}

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl},
  header: {height: 48, justifyContent: 'center', marginLeft: -spacing.sm, marginBottom: spacing.sm},
  valueBlock: {flex: 1, justifyContent: 'center', gap: spacing.lg},
  stepperRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  valueWrap: {flex: 1, alignItems: 'center'},
  value: {fontFamily: fonts.extrabold, fontSize: 88, lineHeight: 96, letterSpacing: -3, color: colors.text, fontVariant: ['tabular-nums']},
  step: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  stepPressed: {backgroundColor: colors.primarySoft},
  stepDisabled: {opacity: 0.35},
  presets: {flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl},
  preset: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetActive: {backgroundColor: colors.primary, borderColor: colors.primary},
});
