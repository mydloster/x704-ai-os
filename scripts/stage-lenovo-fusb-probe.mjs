import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { adaptFusbSource } from './lenovo-fusb-adaptations.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2]) throw new Error('Pass the disposable kernel checkout');
const kernel=path.resolve(process.argv[2]);
const version=fs.readFileSync(path.join(kernel,'Makefile'),'utf8');
if(!/^VERSION\s*=\s*4$/m.test(version)||!/^PATCHLEVEL\s*=\s*9$/m.test(version)) throw new Error('Expected kernel 4.9');
const plan=JSON.parse(fs.readFileSync(path.join(project,'manifests/lenovo-fusb-sources.json'),'utf8'));
if(plan.repository!=='lukaspieper/android_kernel_lenovo_msm8953'||plan.revision!=='f21bb40e154a77e3e74da519e2477cf23a6fd261'||plan.files.length!==52) throw new Error('Unexpected FUSB source plan');
const parent=path.join(kernel,'drivers/power/supply/qcom');
const configPath=path.join(parent,'Kconfig'), makePath=path.join(parent,'Makefile');
const config=fs.readFileSync(configPath,'utf8'), make=fs.readFileSync(makePath,'utf8');
if(config.includes('x704-onsemi')||make.includes('x704-onsemi')) throw new Error('FUSB integration already present');
const pending=[];
for(const file of plan.files) {
  if(!/^drivers\/power\/onsemi\/[A-Za-z0-9_./]+$/.test(file.sourcePath)||file.sourcePath.includes('..')) throw new Error('Invalid FUSB source path');
  const expected='drivers/power/supply/qcom/x704-onsemi/'+file.sourcePath.slice('drivers/power/onsemi/'.length);
  if(file.targetPath!==expected) throw new Error('Unexpected FUSB target');
  const target=path.join(kernel,file.targetPath);
  if(fs.existsSync(target)) throw new Error('Refusing to overwrite existing FUSB source');
  const response=await fetch(`https://raw.githubusercontent.com/${plan.repository}/${plan.revision}/${file.sourcePath}`);
  if(!response.ok) throw new Error(`Download failed: ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256) throw new Error(`Hash mismatch: ${file.sourcePath}`);
  const relative=file.sourcePath.slice('drivers/power/onsemi/'.length);
  const adapted=adaptFusbSource(relative,bytes.toString('utf8'));
  pending.push({target,bytes:Buffer.from(adapted)});
}
for(const item of pending) {fs.mkdirSync(path.dirname(item.target),{recursive:true});fs.writeFileSync(item.target,item.bytes,{flag:'wx'});}
fs.writeFileSync(configPath,config+'\nsource "drivers/power/supply/qcom/x704-onsemi/Kconfig"\n');
fs.writeFileSync(makePath,make+'\nobj-$(CONFIG_USB_FUSB302) += x704-onsemi/\n');
console.log('Staged 52 hash-verified FUSB302 sources with explicit wakeup-source API migration. Required Lenovo dwc3/VBUS glue is NOT implemented.');
