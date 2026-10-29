// Whole-body sprite candidate. Keep it out of the default renderer until visually approved.
const fs = require('fs');
const path = require('path');
const project = path.resolve('assets/rive/rabbit-crawl');
const config = JSON.parse(
  fs.readFileSync(path.join(project, 'frames.json'), 'utf8'),
);
const motions = ['idle', 'walk', 'run', 'sprint', 'stone', 'jump'];
const lengths = [144, 48, 32, 24, 60, 42];
const previewMotion =
  process.argv.find(a => a.startsWith('--preview-motion='))?.split('=')[1] ||
  'idle';
const defaultState = motions.indexOf(previewMotion);
if (defaultState < 0) throw Error('Unknown preview motion');
const speed = { walk: 4, run: 8, sprint: 13 }[previewMotion] || 0;
const bool = (id, truth) =>
  `<TransitionBoolCondition inputId="0:${id}" opValue="${
    truth ? 'equal' : 'notEqual'
  }"/>`;
const num = (op, value) =>
  `<TransitionNumberCondition inputId="0:10" opValue="${op}" value="${value}"/>`;
const conditions = i =>
  i === 4
    ? bool(12, true)
    : bool(12, false) +
      bool(11, i !== 0) +
      (i === 1
        ? num('lessThan', 6)
        : i === 2
        ? num('greaterThanOrEqual', 6) + num('lessThan', 11)
        : i === 3
        ? num('greaterThanOrEqual', 11)
        : '');
const states = motions
  .map((name, i) => {
    let transitions =
      i !== 4
        ? `<StateTransition stateToId="0:104" duration="80">${conditions(
            4,
          )}</StateTransition>`
        : '';
    if (i < 4)
      transitions += `<StateTransition stateToId="0:105" duration="60">${bool(
        12,
        false,
      )}<TransitionTriggerCondition inputId="0:13"/></StateTransition>`;
    for (let j = 0; j < 4; j++)
      if (i !== j)
        transitions += `<StateTransition stateToId="0:${
          100 + j
        }" duration="100" ${
          i === 5
            ? 'enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"'
            : ''
        }>${conditions(j)}</StateTransition>`;
    return `<AnimationState animationId="0:${200 + i}" id="0:${100 + i}" x="${
      180 + i * 170
    }" y="${(i % 2) * 140}" reset="true">${transitions}</AnimationState>`;
  })
  .join('');
const images = config.frames
  .map((frame, i) => {
    const [x, y, width, height] = frame.rect;
    const left = config.eyeX - frame.eyeX * config.scale;
    const top = config.groundY - frame.floor * config.scale;
    const w = width * config.scale,
      h = height * config.scale;
    const vertices = [
      [left, top, x, y],
      [left + w, top, x + width, y],
      [left + w, top + h, x + width, y + height],
      [left, top + h, x, y + height],
    ];
    return `<Image assetId="0:60" name="Whole body frame ${i}" id="0:${
      1000 + i
    }" opacity="${
      i === 1 ? 1 : 0
    }"><Mesh triangleIndexBytes="AAECAAID">${vertices
      .map(
        v =>
          `<ContourMeshVertex x="${v[0]}" y="${v[1]}" u="${
            v[2] / config.width
          }" v="${v[3] / config.height}"/>`,
      )
      .join('')}</Mesh></Image>`;
  })
  .join('');
const animations = motions
  .map((name, i) => {
    const duration = lengths[i];
    const moving = i > 0 && i < 4;
    const keys = config.frames
      .map((frame, frameIndex) => {
        const samples = moving ? 9 : 1;
        const values = Array.from(
          { length: samples },
          (_, sample) =>
            `<KeyFrameDouble frame="${
              moving ? (sample * duration) / 8 : 0
            }" value="${
              frameIndex === (moving ? sample % 8 : 1) ? 1 : 0
            }" interpolationType="hold"/>`,
        ).join('');
        return `<KeyedObject objectId="0:${
          1000 + frameIndex
        }"><KeyedProperty property="opacity">${values}</KeyedProperty></KeyedObject>`;
      })
      .join('');
    let body = '';
    if (name === 'jump')
      body = `<KeyedObject objectId="0:20"><KeyedProperty property="y"><KeyFrameDouble frame="0" value="0" interpolationType="linear"/><KeyFrameDouble frame="8" value="4" interpolationType="linear"/><KeyFrameDouble frame="20" value="-35" interpolationType="linear"/><KeyFrameDouble frame="34" value="0" interpolationType="linear"/><KeyFrameDouble frame="42" value="0"/></KeyedProperty></KeyedObject>`;
    else
      body =
        '<KeyedObject objectId="0:20"><KeyedProperty property="y"><KeyFrameDouble frame="0" value="0"/></KeyedProperty></KeyedObject>';
    return `<LinearAnimation name="${name}" id="0:${
      200 + i
    }" duration="${duration}" fps="60" loopValue="${
      name === 'jump' ? 'oneShot' : 'loop'
    }">${keys}${body}</LinearAnimation>`;
  })
  .join('');
const rml = `<Rive version="1" kind="fragment"><ImageAsset file="${
  config.atlas
}" name="Crawl whole-body atlas" id="0:60"/><Artboard name="baby" width="500" height="500" styleId="0:5" defaultStateMachineId="0:7" id="0:2"><LayoutComponentStyle id="0:5" name="Artboard Style"/><Node name="body" id="0:20"><Node name="Whole body poses" id="0:21">${images}</Node></Node><StateMachine name="Character" id="0:7"><StateMachineNumber name="speed" value="${speed}" id="0:10"/><StateMachineBool name="running" value="${
  speed > 0
}" id="0:11"/><StateMachineBool name="stone" value="${
  previewMotion === 'stone'
}" id="0:12"/><StateMachineTrigger name="jump" id="0:13"/><StateMachineLayer name="Motion"><AnyState x="180" y="-150"/><ExitState x="400" y="-150"/><EntryState x="0" y="0"><StateTransition stateToId="0:${
  100 + defaultState
}"/></EntryState>${states}</StateMachineLayer></StateMachine>${animations}</Artboard></Rive>`;
fs.writeFileSync(path.join(project, 'scene.rml'), rml);
console.log('Crawl candidate generated; not approved for default rendering.');
if (process.argv.includes('--export-preview')) {
  if (previewMotion !== 'idle')
    throw Error('Preview export must start at idle');
  const { spawnSync } = require('child_process');
  const cli =
    process.env.RIVE_CLI ||
    path.join(
      require('os').homedir(),
      '.rive',
      'bin',
      process.platform === 'win32' ? 'rive.exe' : 'rive',
    );
  function run(args) {
    const result = spawnSync(cli, args, { encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error(result.stderr || result.stdout);
    return result.stdout;
  }
  run([project, '--verify']);
  const report = JSON.parse(run(['inspect', project, '--summary']));
  if (report.problems.length) throw Error(JSON.stringify(report.problems));
  run([project, '--once']);
  fs.copyFileSync(
    path.join(project, 'build', 'rabbit-crawl.riv'),
    path.join(project, '..', 'rabbit-crawl-candidate.riv'),
  );
  console.log(
    'Exported developer preview only; default asset registry remains unchanged.',
  );
}
