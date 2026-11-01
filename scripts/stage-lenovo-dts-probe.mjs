import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { adaptTopLevelDts, adaptOverlayOrder, adaptAudioLabels, adaptHapticNode, adaptRamoops } from './lenovo-dts-adaptations.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Pass the disposable reference kernel checkout path.');
const kernel = path.resolve(process.argv[2]);
const makefile = fs.readFileSync(path.join(kernel, 'Makefile'), 'utf8');
if (!/^VERSION\s*=\s*4$/m.test(makefile) || !/^PATCHLEVEL\s*=\s*9$/m.test(makefile)) throw new Error('Expected a 4.9 kernel source checkout.');
const plan = JSON.parse(fs.readFileSync(path.join(project, 'manifests', 'lenovo-dts-sources.json'), 'utf8'));
if (plan.repository !== 'lukaspieper/android_kernel_lenovo_msm8953' || plan.revision !== 'f21bb40e154a77e3e74da519e2477cf23a6fd261') throw new Error('Unexpected upstream reference.');
const downloads = [];
// Fetch and verify everything before modifying the disposable candidate checkout.
for (const file of plan.files) {
  if (!/^arch\/arm\/boot\/dts\/qcom\/(tbx704\/)?[A-Za-z0-9_.-]+$/.test(file.sourcePath)) throw new Error('Invalid source path.');
  if (!/^arch\/arm64\/boot\/dts\/qcom\/(tbx704\/)?[A-Za-z0-9_.-]+$/.test(file.targetPath)) throw new Error('Invalid target path.');
  const target = path.join(kernel, file.targetPath);
  if (fs.existsSync(target)) throw new Error(`Refusing to overwrite existing file: ${file.targetPath}`);
  const response = await fetch(`https://raw.githubusercontent.com/${plan.repository}/${plan.revision}/${file.sourcePath}`);
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${file.sourcePath}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Hash mismatch: ${file.name}`);
  const adaptations = {
    'tbx704-msm8953-qrd.dts': adaptTopLevelDts,
    'tbx704-overlay.dtsi': adaptOverlayOrder,
    'tbx704-msm8953-qrd-sku3.dtsi': adaptAudioLabels,
    'tbx704-msm-pmi8950.dtsi': adaptHapticNode,
    'tbx704-msm8953.dtsi': adaptRamoops,
  };
  const stagedBytes = adaptations[file.name] ? Buffer.from(adaptations[file.name](bytes.toString('utf8'))) : bytes;
  downloads.push({ target, bytes: stagedBytes });
}
for (const item of downloads) {
  fs.mkdirSync(path.dirname(item.target), { recursive: true });
  fs.writeFileSync(item.target, item.bytes, { flag: 'wx' });
}
console.log(`Staged ${downloads.length} hash-checked Lenovo DTS/DTSI files with 4.9 PMIC includes, overlay ordering and codec label adaptations. Drivers, audio routing and memory layout are NOT ported or validated.`);
