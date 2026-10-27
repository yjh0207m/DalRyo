// Rebuild the canonical idle-entry file, validate the resolved Rive tree,
// then copy the binary into the app. A preview-only file is never shipped.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { buildCharacter } = require('./build-character.cjs');

const project = path.resolve(process.argv[2] || 'assets/rive/rabbit-v3');
const output = process.argv[3] && path.resolve(process.argv[3]);
const config = JSON.parse(
  fs.readFileSync(path.join(project, 'character.json'), 'utf8'),
);
if (!config.stone) throw Error('App export requires a stone material variant');
const cli =
  process.env.RIVE_CLI ||
  path.join(
    os.homedir(),
    '.rive',
    'bin',
    process.platform === 'win32' ? 'rive.exe' : 'rive',
  );
function run(args) {
  const result = spawnSync(cli, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Error(result.stderr || result.stdout || `Rive exit ${result.status}`);
  return result.stdout;
}
for (const asset of [config.atlas, config.blink, config.stone].filter(
  Boolean,
)) {
  if (!fs.existsSync(path.join(project, asset.file)))
    throw Error(`Missing artwork: ${asset.file}`);
}
fs.writeFileSync(path.join(project, 'scene.rml'), buildCharacter(config));
process.stdout.write(run([project, '--verify']));
const report = JSON.parse(run(['inspect', project, '--summary']));
if (report.problems.length) throw Error(JSON.stringify(report.problems));
const artboard = report.artboards.find(a => a.name === config.stage);
if (
  !artboard ||
  artboard.types.Bone !== 6 ||
  artboard.types.LinearAnimation !== 6
)
  throw Error('Incomplete motion rig');
const { name } = require('yaml').parse(
  fs.readFileSync(path.join(project, 'rive.yaml'), 'utf8'),
);
process.stdout.write(run([project, '--once']));
const built = path.join(project, 'build', `${name}.riv`);
const size = fs.statSync(built).size;
if (size > (config.maxFileBytes || 3_000_000))
  throw Error(`Asset exceeds configured budget: ${size} bytes`);
if (output) {
  fs.copyFileSync(built, output);
  console.log(`Exported ${output} (${size} bytes)`);
} else console.log(`Built ${built} (${size} bytes)`);
