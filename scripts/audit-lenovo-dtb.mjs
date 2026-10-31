// Read-only structural inspection of the compile-probe DTB. No device access.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseDtb(bytes) {
  if (bytes.length < 40 || bytes.readUInt32BE(0) !== 0xd00dfeed) throw new Error('Invalid DTB header');
  const total = bytes.readUInt32BE(4), structure = bytes.readUInt32BE(8), strings = bytes.readUInt32BE(12);
  const stringSize = bytes.readUInt32BE(32), structSize = bytes.readUInt32BE(36);
  if (total > bytes.length || structure < 40 || strings < 40 || structure + structSize > total || strings + stringSize > total) throw new Error('Invalid DTB section bounds');
  const end = structure + structSize, nodes = [], stack = [];
  let pos = structure, finished = false;
  function word() { if (pos + 4 > end) throw new Error('Truncated DTB word'); const n = bytes.readUInt32BE(pos); pos += 4; return n; }
  while (pos < end) {
    const token = word();
    if (token === 1) {
      const zero = bytes.indexOf(0, pos);
      if (zero < pos || zero >= end) throw new Error('Unterminated DTB node');
      const name = bytes.toString('utf8', pos, zero);
      pos = (zero + 4) & ~3;
      const parent = stack[stack.length - 1];
      const node = { name, path: parent ? (parent.path === '/' ? '/' : parent.path + '/') + name : '/', parent: parent?.path ?? null, properties: {} };
      if (!parent && nodes.length) throw new Error('Multiple DTB roots');
      nodes.push(node); stack.push(node);
    } else if (token === 2) {
      if (!stack.length) throw new Error('Unbalanced DTB node'); stack.pop();
    } else if (token === 3) {
      const length = word(), offset = word();
      if (!stack.length || pos + length > end || offset >= stringSize) throw new Error('Invalid DTB property');
      const zero = bytes.indexOf(0, strings + offset);
      if (zero < 0 || zero >= strings + stringSize) throw new Error('Invalid DTB property name');
      const name = bytes.toString('utf8', strings + offset, zero), properties = stack[stack.length - 1].properties;
      if (Object.hasOwn(properties, name)) throw new Error('Duplicate DTB property');
      properties[name] = bytes.subarray(pos, pos + length);
      pos = (pos + length + 3) & ~3;
    } else if (token === 9) {
      if (stack.length || !nodes.length) throw new Error('Unbalanced DTB end'); finished = true; break;
    } else if (token !== 4) throw new Error('Invalid DTB token');
  }
  if (!finished) throw new Error('Missing DTB end token');
  return nodes;
}

const stringsOf = b => b ? b.toString('utf8').replace(/\0$/, '').split('\0') : [];
const hexOf = b => b ? b.toString('hex').match(/.{1,8}/g)?.join(' ') ?? '' : null;
export function auditDtb(bytes) {
  const nodes = parseDtb(bytes), root = nodes[0];
  const selected = nodes.filter(n => /qseecom|reserved-memory|ramoops|sdhc|sdhci|haptic|charger|qcom,fg|codec|goodix|fusb|nt51021/i.test(n.path + ' ' + stringsOf(n.properties.compatible).join(' ')));
  const addressGroups = new Map();
  for (const n of nodes) {
    if (!n.name.includes('@')) continue;
    const key = n.parent + '@' + n.name.split('@').pop().toLowerCase();
    if (!addressGroups.has(key)) addressGroups.set(key, []);
    addressGroups.get(key).push(n);
  }
  return {
    scope: 'Structural compile-probe audit only. No board, driver, power or boot validation.',
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'), nodeCount: nodes.length,
    model: stringsOf(root.properties.model), compatible: stringsOf(root.properties.compatible),
    boardIdHex: hexOf(root.properties['qcom,board-id']), msmIdHex: hexOf(root.properties['qcom,msm-id']),
    sameParentUnitAddressGroups: [...addressGroups.values()].filter(a => a.length > 1).map(a => a.map(n => ({path:n.path,status:stringsOf(n.properties.status),compatible:stringsOf(n.properties.compatible)}))),
    selectedNodes: selected.map(n => ({path:n.path,compatible:stringsOf(n.properties.compatible),status:stringsOf(n.properties.status),regHex:hexOf(n.properties.reg),memoryRegionHex:hexOf(n.properties['memory-region'])})),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Pass the DTB path');
  console.log(JSON.stringify(auditDtb(fs.readFileSync(process.argv[2])), null, 2));
}
