# 달료 캐릭터 Rive 제작 규격

앱이 캐릭터를 Rive로 그리기 위해 `.riv` 파일이 지켜야 할 약속이다.
파일이 이 규격을 지키면 업로드만으로 앱에 바로 반영되고, 파일이 없거나 규격이 맞지 않는 동물은 기존 PNG 애니메이션으로 자동 대체된다.

- 앱 쪽 구현: `src/components/character/RiveCharacter.tsx`, `CharacterView.tsx`
- 런타임: `rive-react-native` 9.x (상태 머신 입력 방식)

---

## 1. 파일과 업로드 위치

| 항목 | 규칙 |
|---|---|
| 파일 단위 | **동물 1종 = `.riv` 파일 1개** |
| 파일 이름 | `{type}.riv` (예: `rabbit.riv`, `goldpig.riv`) — `type`은 Storage `characters/` 폴더 이름과 같다 |
| 업로드 경로 | Firebase Storage `characters/{type}/{type}.riv` (기존 PNG 옆) |
| 용량 | 동물당 **500KB 이하** 권장 (첫 화면 로딩) |

동물 37종: bear, capybara, cat, cheetah, chick, chicken, cow, crocodile, deer, dog, duck, eagle, elephant, fox, frog, giraffe, goldpig, gorilla, hamster, hippo, horse, koala, lion, monkey, ostrich, otter, penguin, pig, platypus, quokka, rabbit, raccoon, sheep, sparrow, squirrel, tiger, zebra

## 2. 아트보드 (성장 단계)

파일 하나에 성장 단계별 아트보드 3개를 둔다. 이름은 **정확히** 아래와 같아야 한다.

| 아트보드 이름 | 단계 | 참고 PNG |
|---|---|---|
| `baby` | 아기 (첫 달리기 후) | `{type}_S.png` |
| `child` | 어린이 (누적 50km) | `{type}_M.png` |
| `runner` | 러너 (누적 200km) | `{type}_L.png` |

알(egg) 단계는 앱의 기존 PNG를 그대로 쓰므로 만들지 않는다.

**크기와 기준점**

- 아트보드는 **정사각형** (권장 500×500)
- 캐릭터의 **발바닥이 아트보드 높이의 82% 지점**에 닿게 배치 (앱의 그림자·땅 위치가 이 기준을 쓴다)
- 캐릭터는 **오른쪽을 보는 방향**으로 그린다. 왼쪽 방향은 앱이 좌우 반전한다
- 배경은 투명, 발밑 그림자는 그리지 않는다 (앱이 그린다)

## 3. 상태 머신

각 아트보드에 상태 머신을 하나 두고 이름은 **`Character`**.

### 입력 (Inputs)

| 이름 | 종류 | 값 | 앱이 넘기는 때 |
|---|---|---|---|
| `speed` | Number | km/h (0, 4, 8, 13 중 하나) | 상태가 바뀔 때마다 |
| `running` | Boolean | 달리는 중이면 true | 상태가 바뀔 때마다 |
| `stone` | Boolean | 돌 변신(7일 미달리기)이면 true | 상태가 바뀔 때마다 |
| `jump` | Trigger | — | 홈에서 캐릭터를 탭했을 때 |

`speed` 구간은 앱의 모션 구간과 같다: 0 = 쉬는 중, 4 = 느릿느릿(~6km/h), 8 = 달려달려(6~11), 13 = 질주본능(11+).

### 필요한 애니메이션과 전환

| 애니메이션 | 반복 | 조건 |
|---|---|---|
| `idle` | 반복 | 기본 상태. 숨쉬기, 눈 깜빡임, 가끔 두리번 |
| `walk` | 반복 | `running` = true 이고 `speed` < 6 |
| `run` | 반복 | `running` = true 이고 6 ≤ `speed` < 11 |
| `sprint` | 반복 | `running` = true 이고 `speed` ≥ 11 |
| `jump` | 1회 | `jump` 트리거 → 끝나면 이전 상태로 |
| `stone` | 반복(정지 가능) | `stone` = true. 회색으로 굳은 모습, 아주 미세한 떨림 정도 |

- 상태 사이 전환은 블렌드(0.15~0.25초)로 부드럽게
- 달리기 계열은 **제자리 달리기**다 (앱이 배경을 흘려서 앞으로 가는 것처럼 보이게 한다). 몸이 아트보드 밖으로 이동하지 않게 한다
- 걷기·달리기 한 사이클 길이 권장: walk 0.56초, run 0.40초, sprint 0.30초 (앱의 흙먼지 박자와 맞춤)

## 4. 리깅 가이드

- 머리 / 몸통 / 팔 2 / 다리 2 / 귀·꼬리 등 부위를 나눠 뼈대(bone)에 연결
- 이미지 메시(mesh) 변형을 쓰면 기존 PNG 일러스트 질감을 살릴 수 있다
- 37종 × 3단계를 모두 따로 리깅하기보다, **체형이 비슷한 동물끼리 뼈대 구조를 공유**하고 부위 이미지만 바꾸는 방식을 권장

## 5. 옷 입히기 (2단계 기능 대비)

옷은 **교체 가능한 이미지 에셋(Referenced Asset)**으로 만든다. 앱이 런타임에 이미지를 바꿔 끼운다.

| 슬롯 | 에셋 이름 | 붙는 뼈대 |
|---|---|---|
| 등 (몸 뒤) | `back` | 몸통 |
| 하의 | `bottom` | 골반·다리 |
| 상의 | `top` | 몸통·팔 |
| 신발 | `shoes` | 발 |
| 모자 | `hat` | 머리 |
| 액세서리 | `accessory` | 머리 또는 몸통 |

- 기본 상태에서는 빈(투명) 이미지로 둔다
- 각 슬롯 이미지는 해당 뼈대에 붙여 캐릭터와 함께 움직이게 한다
- 앱의 `character.equipped` 값(슬롯별 아이템 id)에 따라 이미지를 교체한다

## 6. 검수 체크리스트

- [ ] 파일 이름 `{type}.riv`, 아트보드 `baby` / `child` / `runner`
- [ ] 상태 머신 이름 `Character`, 입력 `speed` / `running` / `stone` / `jump`
- [ ] 정사각형 아트보드, 발바닥이 높이 82% 지점, 오른쪽 방향
- [ ] 달리기는 제자리, 아트보드 밖으로 안 나감
- [ ] 투명 배경, 바닥 그림자 없음
- [ ] 500KB 이하
- [ ] Rive 에디터의 State Machine 미리보기에서 입력을 바꿔 모든 전환 확인

## 7. 반영 방법

1. Storage `characters/{type}/{type}.riv`로 업로드
2. 앱을 다시 열면 해당 동물은 자동으로 Rive로 표시된다 (다른 동물은 계속 PNG)
3. 문제가 있으면 파일만 지우면 PNG로 돌아간다
