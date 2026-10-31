import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRelease, requiredHardware } from '../scripts/evaluate-release.mjs';

function completeFixture() {
  return {
    imageSha256: 'a'.repeat(64), androidApi: 33,
    build: { status: 'PASS', evidence: 'synthetic-fixture-not-real-build' },
    hardware: Object.fromEntries(requiredHardware.map(name => [name, { status: 'PASS', evidence: 'synthetic-fixture' }])),
    apps: [{ package: 'example.player', version: 'test', evidence: 'synthetic-fixture', launch: 'PASS', signIn: 'PASS', coreFunction: 'PASS', streaming: true, playback: 'PASS', audio: 'PASS', suspendResume: 'PASS', observedResolution: '1920x1080' }],
  };
}
test('a buildable image alone is not a candidate', () => {
  assert.equal(evaluateRelease({ imageSha256: 'b'.repeat(64), androidApi: 33, build: { status: 'PASS', evidence: 'fixture' } }).candidate, false);
});
test('missing SIM blocks LTE acceptance rather than silently passing', () => {
  const r = completeFixture(); r.hardware.lte = { status: 'BLOCKED', evidence: 'No SIM' };
  assert.equal(evaluateRelease(r).candidate, false);
});
test('Widevine L1 capability is not a substitute for actual playback', () => {
  const r = completeFixture(); r.widevine = { securityLevel: 'L1' }; r.apps[0].playback = 'NOT_TESTED';
  assert.equal(evaluateRelease(r).candidate, false);
});
test('complete evidence passes the synthetic gate but never authorizes flash', () => {
  const result = evaluateRelease(completeFixture());
  assert.equal(result.candidate, true); assert.equal(result.flashAuthorized, false);
});
