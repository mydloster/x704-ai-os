import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptCoulometerPm } from '../scripts/lenovo-coulometer-adaptations.mjs';

const fixture = '#include <linux/module.h>\nstatic struct i2c_driver CM_i2c_driver = {\n.driver = { .of_match_table = couloMeter_of_match, },\n\t.suspend     = cm_i2c_suspend,\n\t.resume      = cm_i2c_resume,\n};\nstatic int cm_i2c_suspend(struct i2c_client *client,pm_message_t msg) { return 0; }\n#define REG_VOLTAGE 0x08\n';
test('power callbacks remain wired while driver register logic stays unchanged',()=>{
  const output=adaptCoulometerPm(fixture);
  assert.ok(output.includes('.pm = &cm_pm_ops'));
  assert.ok(output.includes('return cm_i2c_suspend(to_i2c_client(dev), PMSG_SUSPEND)'));
  assert.ok(output.includes('return cm_i2c_resume(to_i2c_client(dev))'));
  assert.equal(output.slice(output.indexOf('static int cm_i2c_suspend')), fixture.slice(fixture.indexOf('static int cm_i2c_suspend')));
  assert.ok(!output.includes('.suspend     ='));
});
test('repeated, incomplete and ambiguous source migrations fail closed',()=>{
  assert.throws(()=>adaptCoulometerPm(adaptCoulometerPm(fixture)));
  assert.throws(()=>adaptCoulometerPm(fixture.replace('.of_match_table','BAD')));
  assert.throws(()=>adaptCoulometerPm(fixture+fixture));
});
