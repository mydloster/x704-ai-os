import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const requiredHardware = ['cold-boot','storage','display-touch','wifi','bluetooth','lte','gps','audio-microphone','camera-front','camera-back','charging','suspend-resume','selinux'];

export function evaluateRelease(report) {
  const blockers = [];
  if (!/^[a-f0-9]{64}$/i.test(report.imageSha256 || '')) blockers.push('Missing concrete image SHA256');
  if (!Number.isInteger(report.androidApi) || report.androidApi < 31) blockers.push('This gate is for a new Android 12+ port, not the existing Android 11 baseline');
  if (report.build?.status !== 'PASS' || !report.build?.evidence) blockers.push('No successful build evidence');
  for (const name of requiredHardware) {
    const result = report.hardware?.[name];
    if (result?.status !== 'PASS' || !result?.evidence) blockers.push(`Hardware unverified: ${name}`);
  }
  if (!Array.isArray(report.apps) || report.apps.length === 0) blockers.push('No application acceptance results');
  for (const app of report.apps || []) {
    if (!app.package || !app.version || !app.evidence) blockers.push('Application result lacks package, version or evidence');
    if (app.launch !== 'PASS' || app.signIn !== 'PASS' || app.coreFunction !== 'PASS') blockers.push(`Application not accepted: ${app.package || 'unknown'}`);
    if (app.streaming && (app.playback !== 'PASS' || app.audio !== 'PASS' || app.suspendResume !== 'PASS' || !app.observedResolution)) blockers.push(`Actual protected playback not verified: ${app.package}`);
  }
  return { candidate: blockers.length === 0, blockers, flashAuthorized: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/evaluate-release.mjs <report.json>');
  const result = evaluateRelease(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  // This only evaluates evidence. It never grants permission or flashes a device.
  process.exitCode = result.candidate ? 0 : 2;
}
