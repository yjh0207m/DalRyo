const fs = require('fs');
const path = require('path');
const { GAITS, frameAt, validateConfig } = require('./biped.cjs');
const fmt = value => Number(value.toFixed(6));
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;');

function buildCharacter(config, options = {}) {
  validateConfig(config);
  const r = config.rig;
  const motions = ['idle', 'walk', 'run', 'sprint', 'stone', 'jump'];
  const durations = {
    idle: 144,
    walk: GAITS.walk.frames,
    run: GAITS.run.frames,
    sprint: GAITS.sprint.frames,
    stone: 60,
    jump: 48,
  };
  const id = n => `0:${n}`;
  let uid = 1000;
  const materials = [];
  const rawImage = (name, box, rotation = 0, asset = 60) => {
    const part = config.parts[name];
    const [x, y, w, h] = part.rect;
    const [left, top, width, height] = box;
    const verts = [
      [left, top, x, y],
      [left + width, top, x + w, y],
      [left + width, top + height, x + w, y + h],
      [left, top + height, x, y + h],
    ];
    const imageId = id(uid++);
    return {
      id: imageId,
      xml: `<Image name="${name}" assetId="0:${asset}" rotation="${rotation}" id="${imageId}"><Mesh name="${name} region" triangleIndexBytes="AAECAAID">${verts
        .map(
          v =>
            `<ContourMeshVertex x="${fmt(v[0])}" y="${fmt(v[1])}" u="${
              v[2] / config.atlas.width
            }" v="${v[3] / config.atlas.height}"/>`,
        )
        .join('')}</Mesh></Image>`,
    };
  };
  const image = (name, box, rotation = 0, asset = 60) => {
    const normal = rawImage(name, box, rotation, asset);
    if (!config.stone || asset !== 60) return normal.xml;
    const stone = rawImage(name, box, rotation, 62);
    const soloId = id(uid++);
    materials.push({ soloId, normal: normal.id, stone: stone.id });
    return `<Solo name="${name} material" activeComponentId="${normal.id}" id="${soloId}">${normal.xml}${stone.xml}</Solo>`;
  };
  const centered = (name, y = 0, asset = 60) => {
    if (!config.parts[name]) return '';
    const [w, h] = config.parts[name].size;
    return image(name, [-w / 2, y - h / 2, w, h], 0, asset);
  };
  const limb = (name, length) =>
    image(
      name,
      [
        -config.parts[name].width / 2,
        -5,
        config.parts[name].width,
        length + 10,
      ],
      -Math.PI / 2,
    );
  const pose0 = frameAt(config, 'idle', 0);
  const arm = side => {
    const near = side === 'near',
      suffix = near ? 'Near' : 'Far',
      base = near ? 40 : 43;
    const [x, y] = r.shoulders[side];
    return `<RootBone name="arm.${side}.upper" x="${x}" y="${y}" length="${
      r.upperArm
    }" rotation="${pose0.arms[side].upper}" id="${id(base)}">
      <Bone name="arm.${side}.lower" length="${r.lowerArm}" rotation="${
      pose0.arms[side].lower
    }" id="${id(base + 1)}">${limb(`lowerArm${suffix}`, r.lowerArm)}</Bone>
      ${limb(`upperArm${suffix}`, r.upperArm)}</RootBone>`;
  };
  const leg = side => {
    const near = side === 'near',
      suffix = near ? 'Near' : 'Far',
      base = near ? 30 : 34;
    const footPart = config.parts[`foot${suffix}`].size;
    return `<RootBone name="leg.${side}.upper" x="${r.hips[side]}" length="${
      r.upperLeg
    }" rotation="${pose0.legs[side].upper}" id="${id(base)}">
      ${limb(`upperLeg${suffix}`, r.upperLeg)}
      <Bone name="leg.${side}.lower" length="${r.lowerLeg}" rotation="${
      pose0.legs[side].lower
    }" id="${id(base + 1)}">
        <Bone name="leg.${side}.foot" length="0" rotation="${
      pose0.legs[side].foot
    }" id="${id(base + 2)}">${image(`foot${suffix}`, [
      -12,
      r.sole - footPart[1],
      ...footPart,
    ])}</Bone>
        ${limb(`lowerLeg${suffix}`, r.lowerLeg)}</Bone></RootBone>`;
  };
  const ear = (side, n) => {
    const name = side === 'near' ? 'earNear' : 'earFar';
    const [x, y] = r[name] || [0, -55];
    const [w, h] = config.parts[name]?.size || [1, 1];
    return `<RootBone name="ear.${side}" x="${x}" y="${y}" length="${h}" id="${id(
      n,
    )}">${
      config.parts[name] ? image(name, [-w / 2, -h + 8, w, h]) : ''
    }</RootBone>`;
  };
  const face = config.blink
    ? `<Solo name="expression" activeComponentId="0:28" id="0:27"><Node name="eyes.open" id="0:28">${centered(
        'head',
      )}</Node><Node name="eyes.closed" id="0:29">${centered(
        'head',
        0,
        61,
      )}</Node></Solo>`
    : centered('head');
  const skeleton = `<Node name="root" x="${r.centerX}" y="${
    pose0.rootY
  }" id="0:20">
    ${arm('near')}
    <RootBone name="body" length="0" id="0:21">
      <RootBone name="head" x="${r.head[0]}" y="${
    r.head[1]
  }" length="0" id="0:22">${face}${ear('near', 23)}${ear('far', 24)}</RootBone>
      <Node name="chest" y="-45" id="0:26">${centered('torso')}</Node>
      ${centered('pelvis', -4)}
    </RootBone>
    ${leg('near')}${arm('far')}${leg('far')}
    <RootBone name="tail" x="-36" y="-10" length="0" id="0:25">${centered(
      'tail',
    )}</RootBone>
  </Node>`;

  const bool = (n, truth) =>
    `<TransitionBoolCondition inputId="${id(n)}" opValue="${
      truth ? 'equal' : 'notEqual'
    }"/>`;
  const number = (op, value) =>
    `<TransitionNumberCondition inputId="0:10" opValue="${op}" value="${value}"/>`;
  function conditions(i) {
    if (i === 4) return bool(12, true);
    return (
      bool(12, false) +
      bool(11, i !== 0) +
      (i === 1
        ? number('lessThan', 6)
        : i === 2
        ? number('greaterThanOrEqual', 6) + number('lessThan', 11)
        : i === 3
        ? number('greaterThanOrEqual', 11)
        : '')
    );
  }
  const states = motions
    .map((motion, i) => {
      let transitions = '';
      // Jump takes priority over locomotion and stone can interrupt any pose.
      if (i !== 4)
        transitions += `<StateTransition stateToId="0:104" duration="100">${conditions(
          4,
        )}</StateTransition>`;
      if (i !== 4 && i !== 5)
        transitions += `<StateTransition stateToId="0:105" duration="55">${bool(
          12,
          false,
        )}<TransitionTriggerCondition inputId="0:13"/></StateTransition>`;
      for (let j = 0; j < 4; j++)
        if (i !== j) {
          const exit =
            i === 5
              ? ' enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"'
              : '';
          transitions += `<StateTransition stateToId="${id(
            100 + j,
          )}" duration="${i === 5 ? 90 : 160}"${exit}>${conditions(
            j,
          )}</StateTransition>`;
        }
      return `<AnimationState x="${180 + i * 190}" y="${
        (i % 2) * 150
      }" animationId="${id(200 + i)}" reset="true" id="${id(
        100 + i,
      )}">${transitions}</AnimationState>`;
    })
    .join('\n');

  function animation(motion, index) {
    const duration = durations[motion];
    // Every frame is authored: exact contact at authored instants, no coarse sine interpolation.
    const frames = Array.from({ length: duration + 1 }, (_, frame) =>
      frameAt(config, motion, frame / duration),
    );
    const tracks = new Map();
    const track = (n, prop, get) => {
      const k = `${n}`;
      if (!tracks.has(k)) tracks.set(k, []);
      tracks
        .get(k)
        .push(
          `<KeyedProperty property="${prop}">${frames
            .map(
              (pose, frame) =>
                `<KeyFrameDouble frame="${frame}" value="${fmt(
                  get(pose),
                )}" interpolationType="linear"/>`,
            )
            .join('')}</KeyedProperty>`,
        );
    };
    track(20, 'y', p => p.rootY);
    track(21, 'rotation', p => p.lean);
    track(26, 'scaleY', p => p.breath);
    track(22, 'rotation', p => p.head);
    track(23, 'rotation', p => p.earNear);
    track(24, 'rotation', p => p.earFar);
    track(25, 'rotation', p => p.tail);
    for (const [side, legBase, armBase] of [
      ['near', 30, 40],
      ['far', 34, 43],
    ]) {
      track(legBase, 'rotation', p => p.legs[side].upper);
      track(legBase + 1, 'rotation', p => p.legs[side].lower);
      track(legBase + 2, 'rotation', p => p.legs[side].foot);
      track(armBase, 'rotation', p => p.arms[side].upper);
      track(armBase + 1, 'rotation', p => p.arms[side].lower);
    }
    const blink = config.blink
      ? `<KeyedObject objectId="0:27"><KeyedProperty property="activeComponentId"><KeyFrameId frame="0" value="0:28"/>${
          motion === 'idle'
            ? '<KeyFrameId frame="94" value="0:29"/><KeyFrameId frame="101" value="0:28"/>'
            : ''
        }</KeyedProperty></KeyedObject>`
      : '';
    const material = materials
      .map(
        m =>
          `<KeyedObject objectId="${
            m.soloId
          }"><KeyedProperty property="activeComponentId"><KeyFrameId frame="0" value="${
            motion === 'stone' ? m.stone : m.normal
          }"/></KeyedProperty></KeyedObject>`,
      )
      .join('');
    return `<LinearAnimation name="${motion}" id="${id(
      200 + index,
    )}" duration="${duration}" fps="60" loopValue="${
      motion === 'jump' ? 'oneShot' : 'loop'
    }">${[...tracks]
      .map(
        ([n, props]) =>
          `<KeyedObject objectId="0:${n}">${props.join('')}</KeyedObject>`,
      )
      .join('')}${blink}${material}</LinearAnimation>`;
  }
  const defaultIndex = options.motion ? motions.indexOf(options.motion) : 0;
  if (defaultIndex < 0) throw Error('Unknown preview motion');
  const previewSpeed = { walk: 4, run: 8, sprint: 13 }[options.motion] || 0;
  const machine = `<StateMachine name="Character" id="0:7"><StateMachineNumber name="speed" value="${previewSpeed}" id="0:10"/><StateMachineBool name="running" value="${
    previewSpeed > 0
  }" id="0:11"/><StateMachineBool name="stone" value="${
    options.motion === 'stone'
  }" id="0:12"/><StateMachineTrigger name="jump" id="0:13"/>
    <StateMachineLayer name="Locomotion"><AnyState x="180" y="-160"/><ExitState x="400" y="-160"/><EntryState x="0" y="0"><StateTransition stateToId="${id(
      100 + defaultIndex,
    )}"/></EntryState>${states}</StateMachineLayer></StateMachine>`;
  return `<Rive version="1" kind="fragment"><ImageAsset file="${esc(
    config.atlas.file,
  )}" name="${esc(config.name)} atlas" id="0:60"/>${
    config.blink
      ? `<ImageAsset file="${esc(config.blink.file)}" name="${esc(
          config.name,
        )} blink" id="0:61"/>`
      : ''
  }${
    config.stone
      ? `<ImageAsset file="${esc(config.stone.file)}" name="${esc(
          config.name,
        )} stone" id="0:62"/>`
      : ''
  }
    <Artboard name="${
      config.stage
    }" width="500" height="500" defaultStateMachineId="0:7" styleId="0:5" id="0:2"><LayoutComponentStyle name="Artboard Style" id="0:5"/>
    ${skeleton}${machine}${motions
    .map(animation)
    .join('\n')}</Artboard></Rive>`;
}

if (require.main === module) {
  const project = path.resolve(process.argv[2] || 'assets/rive/rabbit-v3');
  const config = JSON.parse(
    fs.readFileSync(path.join(project, 'character.json'), 'utf8'),
  );
  const motionArg = process.argv.find(arg =>
    arg.startsWith('--preview-motion='),
  );
  fs.writeFileSync(
    path.join(project, 'scene.rml'),
    buildCharacter(config, { motion: motionArg?.split('=')[1] }),
  );
  console.log(
    `Built ${config.name}: articulated biped, 16 atlas regions, 6 motions`,
  );
}
module.exports = { buildCharacter };
