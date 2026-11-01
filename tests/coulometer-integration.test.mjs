import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temporary=fs.mkdtempSync(path.join(root,'build','coulometer-integration-'));
function fixture(name,version=4){
  const kernel=path.join(temporary,name),parent=path.join(kernel,'drivers/power/supply/qcom');
  fs.mkdirSync(path.join(parent,'x704-coulometer'),{recursive:true});
  fs.writeFileSync(path.join(kernel,'Makefile'),`VERSION = ${version}\nPATCHLEVEL = 9\n`);
  fs.writeFileSync(path.join(parent,'Makefile'),'# Existing upstream build rules\n');
  fs.writeFileSync(path.join(parent,'Kconfig'),'# Existing upstream options\n');
  for(const file of ['couloMeter.c','couloMeter.h','Makefile'])fs.writeFileSync(path.join(parent,'x704-coulometer',file),'# staged fixture\n');
  return {kernel,parent};
}
function run(kernel){return spawnSync(process.execPath,[path.join(root,'scripts/integrate-lenovo-coulometer.mjs'),kernel],{encoding:'utf8'});}
test('integration retains upstream rules and wires a dedicated experimental option',()=>{
  const {kernel,parent}=fixture('valid');assert.equal(run(kernel).status,0);
  assert.match(fs.readFileSync(path.join(parent,'Makefile'),'utf8'),/^# Existing upstream build rules\n/);
  assert.match(fs.readFileSync(path.join(parent,'Makefile'),'utf8'),/obj-\$\(CONFIG_X704_COULOMETER\) \+= x704-coulometer\//);
  assert.match(fs.readFileSync(path.join(parent,'x704-coulometer/Kconfig'),'utf8'),/depends on I2C && ARCH_MSM8953/);
});
test('repeated integration is rejected without changing existing work',()=>{
  const {kernel,parent}=fixture('repeat');assert.equal(run(kernel).status,0);
  const before=fs.readFileSync(path.join(parent,'Makefile'));assert.notEqual(run(kernel).status,0);
  assert.deepEqual(fs.readFileSync(path.join(parent,'Makefile')),before);
});
test('wrong kernel version is rejected before source modifications',()=>{
  const {kernel,parent}=fixture('wrong',5);assert.notEqual(run(kernel).status,0);
  assert.equal(fs.existsSync(path.join(parent,'x704-coulometer/Kconfig')),false);
  assert.equal(fs.readFileSync(path.join(parent,'Makefile'),'utf8'),'# Existing upstream build rules\n');
});
