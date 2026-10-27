import React, {useCallback, useEffect, useRef} from 'react';
import {type ViewStyle} from 'react-native';
import Rive, {Alignment, AutoBind, Fit, RNRiveErrorType, type RiveRef} from 'rive-react-native';
import type {CharacterMotion, CharacterStage} from '../../types/character.types';

// Rive로 그리는 캐릭터 몸. 앱 상태를 Rive 상태 머신 입력으로 넘기고, 움직임은 Rive 파일이 담당한다.
// 파일 규격(아트보드·상태 머신·입력 이름)은 docs/rive-character-spec.md 참고.

export const RIVE_STATE_MACHINE = 'Character';

export const RIVE_INPUTS = {
  speed: 'speed', // Number, km/h
  running: 'running', // Boolean
  stone: 'stone', // Boolean
  jump: 'jump', // Trigger
} as const;

// 모션 이름 → Rive에 넘길 속도. 실제 GPS 속도를 넘기는 대신 구간 대표값을 쓴다 (getMotion 구간과 맞춤)
const MOTION_SPEED: Record<CharacterMotion, number> = {
  idle: 0,
  rest: 0,
  slow: 4,
  run: 8,
  sprint: 13,
  stone: 0,
};

type Props = {
  source: number | string;
  stage: Exclude<CharacterStage, 'egg'>;
  motion: CharacterMotion;
  jumpKey?: number;
  // Rive 컴포넌트는 스타일 배열을 받지 않아 단일 객체만 넘긴다
  style?: ViewStyle;
  // 파일을 못 읽으면 PNG로 되돌아가도록 알린다
  onError: () => void;
};

const INPUTS_ONLY = AutoBind(false);

export function RiveCharacter({source, stage, motion, jumpKey, style, onError}: Props) {
  const riveRef = useRef<RiveRef>(null);

  const applyInputs = useCallback(() => {
    const rive = riveRef.current;
    if (!rive) return;
    const running = motion === 'slow' || motion === 'run' || motion === 'sprint';
    rive.setInputState(RIVE_STATE_MACHINE, RIVE_INPUTS.speed, MOTION_SPEED[motion]);
    rive.setInputState(RIVE_STATE_MACHINE, RIVE_INPUTS.running, running);
    rive.setInputState(RIVE_STATE_MACHINE, RIVE_INPUTS.stone, motion === 'stone');
  }, [motion]);

  useEffect(applyInputs, [applyInputs]);

  useEffect(() => {
    if (!jumpKey) return;
    riveRef.current?.fireState(RIVE_STATE_MACHINE, RIVE_INPUTS.jump);
  }, [jumpKey]);

  return (
    <Rive
      ref={riveRef}
      source={typeof source === 'number' ? source : {uri: source}}
      dataBinding={INPUTS_ONLY}
      artboardName={stage}
      stateMachineName={RIVE_STATE_MACHINE}
      autoplay
      fit={Fit.Contain}
      alignment={Alignment.Center}
      style={style}
      // 파일을 다 읽기 전에 넘긴 입력은 무시될 수 있어, 재생이 시작되면 현재 상태를 다시 넘긴다
      onPlay={applyInputs}
      onError={error => {
        if (FATAL_ERRORS.has(error.type)) onError();
      }}
    />
  );
}

// 캐릭터를 아예 못 그리는 오류만 PNG로 되돌린다. 입력 이름 누락·데이터 바인딩 미사용 같은 오류는 애니메이션이 그대로 돌기 때문에 무시
const FATAL_ERRORS = new Set<RNRiveErrorType>([
  RNRiveErrorType.FileNotFound,
  RNRiveErrorType.IncorrectRiveFileUrl,
  RNRiveErrorType.MalformedFile,
  RNRiveErrorType.UnsupportedRuntimeVersion,
  RNRiveErrorType.IncorrectArtboardName,
  RNRiveErrorType.IncorrectStateMachineName,
]);
