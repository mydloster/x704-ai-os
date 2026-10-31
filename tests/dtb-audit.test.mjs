import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDtb, auditDtb } from '../scripts/audit-lenovo-dtb.mjs';

function fixture() {
  const word = n => { const b=Buffer.alloc(4); b.writeUInt32BE(n); return b; };
  const cstr = s => { const b=Buffer.from(s+'\0'); return Buffer.concat([b, Buffer.alloc((4-b.length%4)%4)]); };
  const names=Buffer.from('model\0status\0');
  const prop=(offset,s)=>{const v=cstr(s);return Buffer.concat([word(3),word(Buffer.byteLength(s)+1),word(offset),v]);};
  const structure=Buffer.concat([word(1),cstr(''),prop(0,'test board'),word(1),cstr('a@1000'),prop(6,'disabled'),word(2),word(1),cstr('b@1000'),word(2),word(2),word(9)]);
  const header=Buffer.alloc(40), reserve=Buffer.alloc(16);
  [0xd00dfeed,56+structure.length+names.length,56,56+structure.length,40,17,16,0,names.length,structure.length].forEach((n,i)=>header.writeUInt32BE(n,i*4));
  return Buffer.concat([header,reserve,structure,names]);
}

test('binary DTB parsing preserves paths and reports address collisions without declaring hardware pass',()=>{
  const bytes=fixture(); const report=auditDtb(bytes);
  assert.deepEqual(parseDtb(bytes).map(n=>n.path),['/','/a@1000','/b@1000']);
  assert.deepEqual(report.model,['test board']);
  assert.equal(report.sameParentUnitAddressGroups.length,1);
  assert.equal(report.sameParentUnitAddressGroups[0][0].status[0],'disabled');
  assert.match(report.scope,/No board/);
});

test('truncated and out-of-bounds DTBs are rejected',()=>{
  const bytes=fixture(); assert.throws(()=>parseDtb(bytes.subarray(0,bytes.length-1)));
  const bad=Buffer.from(bytes); bad.writeUInt32BE(0xffffffff,12); assert.throws(()=>parseDtb(bad));
});

test('invalid token and unbalanced termination cannot produce a misleading audit',()=>{
  const bad=fixture(); bad.writeUInt32BE(9,56); assert.throws(()=>parseDtb(bad));
  const invalid=fixture(); invalid.writeUInt32BE(77,56); assert.throws(()=>parseDtb(invalid));
});
