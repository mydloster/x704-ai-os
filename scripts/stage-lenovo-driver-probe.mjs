import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Pass the disposable kernel checkout path');
const kernel = path.resolve(process.argv[2]);
const makefile = fs.readFileSync(path.join(kernel, 'Makefile'), 'utf8');
if (!/^VERSION\s*=\s*4$/m.test(makefile) || !/^PATCHLEVEL\s*=\s*9$/m.test(makefile)) throw new Error('Expected kernel 4.9');
const plan = JSON.parse(fs.readFileSync(path.join(project, 'manifests/lenovo-driver-sources.json'), 'utf8'));
if (plan.repository !== 'lukaspieper/android_kernel_lenovo_msm8953' || plan.revision !== 'f21bb40e154a77e3e74da519e2477cf23a6fd261') throw new Error('Unexpected source reference');
const pending = [];
for (const file of plan.files) {
  if (!/^(drivers\/power\/couloMeter\.[ch]|arch\/arm64\/configs\/lineageos_tbx704_defconfig)$/.test(file.sourcePath)) throw new Error('Invalid source path');
  if (!/^(drivers\/power\/supply\/qcom\/x704-coulometer\/couloMeter\.[ch]|arch\/arm64\/configs\/x704_legacy_probe_defconfig)$/.test(file.targetPath)) throw new Error('Invalid target path');
  const target = path.join(kernel, file.targetPath);
  if (fs.existsSync(target)) throw new Error('Refusing to overwrite existing driver/configuration');
  const response = await fetch(`https://raw.githubusercontent.com/${plan.repository}/${plan.revision}/${file.sourcePath}`);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Hash mismatch: ${file.sourcePath}`);
  pending.push({target,bytes});
}
const kbuild = path.join(kernel, 'drivers/power/supply/qcom/x704-coulometer/Makefile');
if (fs.existsSync(kbuild)) throw new Error('Refusing to overwrite existing Kbuild');
for (const item of pending) {
  fs.mkdirSync(path.dirname(item.target), {recursive:true});
  fs.writeFileSync(item.target, item.bytes, {flag:'wx'});
}
fs.writeFileSync(kbuild, 'obj-y += couloMeter.o\n', {flag:'wx'});
console.log('Staged hash-verified legacy battery driver and config for compile probes only. Not integrated into a boot image.');
