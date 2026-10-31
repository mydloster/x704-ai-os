import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptTopLevelDts, adaptOverlayOrder, adaptAudioLabels, adaptHapticNode } from '../scripts/lenovo-dts-adaptations.mjs';

test('PMIC include migration leaves board identity and all property values intact', () => {
  const input = '#include "msm-pmi8950.dtsi"\n/ { qcom,board-id = <0x0b 0>; };\n#include "msm8953-qrd-sku3.dtsi"\n';
  const output = adaptTopLevelDts(input);
  assert.equal(output.split('\n').filter(x => !x.startsWith('#include')).join('\n'), input.split('\n').filter(x => !x.startsWith('#include')).join('\n'));
  assert.ok(output.includes('#include "pmi8950.dtsi"'));
  assert.ok(output.indexOf('msm8953-pmi8950.dtsi') > output.indexOf('msm8953-qrd-sku3.dtsi'));
  assert.throws(() => adaptTopLevelDts(output));
});

test('PMIC overlay is resolved before qrd without dropping unrelated includes', () => {
  const input = '#include "pins.dtsi"\n#include "tbx704-msm8953-qrd.dtsi"\n#include "camera.dtsi"\n#include "tbx704-msm-pmi8950.dtsi"\n';
  const output = adaptOverlayOrder(input);
  assert.deepEqual(output.match(/#include[^\n]+/g).sort(), input.match(/#include[^\n]+/g).sort());
  assert.ok(output.indexOf('tbx704-msm-pmi8950.dtsi') < output.indexOf('tbx704-msm8953-qrd.dtsi'));
  assert.throws(() => adaptOverlayOrder(output));
});

test('codec status references migrate without copying old incompatible register definitions', () => {
  const input = '&pm8953_diangu_dig { status = "ok"; };\n&pm8953_diangu_analog { status = "ok"; };\n';
  const output = adaptAudioLabels(input);
  assert.equal(output.replace('&msm_digital_codec', '&pm8953_diangu_dig').replace('&pmic_analog_codec', '&pm8953_diangu_analog'), input);
  assert.throws(() => adaptAudioLabels(output));
});

test('haptic migration changes only the node name and rejects ambiguous or repeated input', () => {
  const input = 'pmi_haptic: qcom,haptic@c000 { qcom,vmax-mv = <3200>; };';
  const output = adaptHapticNode(input);
  assert.equal(output.replace('qcom,haptics@c000', 'qcom,haptic@c000'), input);
  assert.throws(() => adaptHapticNode(output));
  assert.throws(() => adaptHapticNode(input + input));
  assert.throws(() => adaptHapticNode(''));
});
