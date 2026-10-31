import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { stageRom } from '../scripts/stage-rom.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(root, 'build', 'rom-tests-'));

test('ROM fragment preserves the upstream partition and security settings while integrating the app', () => {
  const target = path.join(tempRoot, 'valid');
  const result = stageRom(target);
  const board = fs.readFileSync(path.join(target, 'device/lenovo/TBX704/BoardConfig.mk'), 'utf8');
  assert.match(board, /BOARD_USERDATAIMAGE_PARTITION_SIZE := 9652641280/);
  assert.match(board, /SELINUX_IGNORE_NEVERALLOWS := true/); // Known upstream debt, not silently hidden.
  assert.match(board, /BOARD_KERNEL_CMDLINE \+= sdhci_msm\.nocmdq=1/);
  const manifest = fs.readFileSync(path.join(target, 'packages/apps/X704AIAssistant/AndroidManifest.xml'), 'utf8');
  assert.doesNotMatch(manifest, /sharedUserId|uses-permission/);
  assert.equal(result.vendorIncluded, false);
  assert.equal(fs.existsSync(path.join(target, 'vendor')), false);
});

test('existing work is never overwritten', () => {
  const target = path.join(tempRoot, 'existing');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'keep.txt'), 'keep');
  assert.throws(() => stageRom(target), /already exists/);
  assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'keep');
});

test('modified upstream inputs are rejected before output is created', () => {
  const fixture = path.join(tempRoot, 'fixture');
  fs.mkdirSync(path.join(fixture, 'manifests'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'device/upstream'), { recursive: true });
  const lock = {
    device: { snapshot: 'device/upstream', files: { 'BoardConfig.mk': crypto.createHash('sha256').update('expected').digest('hex') } }
  };
  fs.writeFileSync(path.join(fixture, 'manifests/source-lock.json'), JSON.stringify(lock));
  fs.writeFileSync(path.join(fixture, 'device/upstream/BoardConfig.mk'), 'unexpected');
  const destination = path.join(fixture, 'build', 'reject');
  assert.throws(() => stageRom(destination, fixture), /hash mismatch/);
  assert.equal(fs.existsSync(destination), false);
});

test('output outside the project build directory is rejected', () => {
  assert.throws(() => stageRom(path.join(root, 'device', 'unexpected-output')), /restricted/);
});
