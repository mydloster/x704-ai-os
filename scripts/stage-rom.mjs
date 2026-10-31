import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

export function stageRom(destination, projectRoot = root) {
  const lock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'manifests', 'source-lock.json'), 'utf8'));
  const upstream = path.resolve(projectRoot, lock.device.snapshot);
  const out = path.resolve(destination);
  const allowed = path.join(projectRoot, 'build') + path.sep;
  if (!out.startsWith(allowed)) throw new Error('Staging is restricted to the project build directory.');
  if (fs.existsSync(out)) throw new Error('Destination already exists; choose a fresh directory. Nothing overwritten.');
  for (const [name, expected] of Object.entries(lock.device.files)) {
    const actual = sha256(fs.readFileSync(path.join(upstream, name)));
    if (actual !== expected) throw new Error(`Upstream hash mismatch: ${name}`);
  }
  // All inputs are checked before creating the output.
  const device = path.join(out, 'device', 'lenovo', 'TBX704');
  const app = path.join(out, 'packages', 'apps', 'X704AIAssistant');
  fs.mkdirSync(path.dirname(device), { recursive: true });
  fs.cpSync(upstream, device, { recursive: true, filter: source => path.basename(source) !== '.git' });
  fs.cpSync(path.join(projectRoot, 'ai-app'), app, { recursive: true });
  for (const [source, target] of [
    ['AndroidProducts.append.mk', 'AndroidProducts.mk'],
    ['BoardConfig.append.mk', 'BoardConfig.mk'],
  ]) {
    fs.appendFileSync(path.join(device, target), '\n' + fs.readFileSync(path.join(projectRoot, 'device', 'x704-ai', source), 'utf8'));
  }
  fs.copyFileSync(path.join(projectRoot, 'device', 'x704-ai', 'x704_ai_TBX704.mk'), path.join(device, 'x704_ai_TBX704.mk'));
  const record = {
    status: 'source-fragment-only-not-a-ROM-build',
    target: 'x704_ai_TBX704-userdebug',
    deviceRevision: lock.device.revision,
    kernelRevision: lock.kernel.revision,
    appSourceSha256: sha256(fs.readFileSync(path.join(app, 'src', 'sk', 'x704', 'aiassistant', 'MainActivity.java'))),
    vendorIncluded: false,
    fullManifestLocked: false,
  };
  fs.writeFileSync(path.join(out, 'staging-record.json'), JSON.stringify(record, null, 2) + '\n');
  return record;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/stage-rom.mjs <fresh project/build/subdirectory>');
  console.log(JSON.stringify(stageRom(process.argv[2]), null, 2));
}
