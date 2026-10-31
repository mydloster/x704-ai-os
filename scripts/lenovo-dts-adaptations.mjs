// Compile-probe adaptation derived from the reference 4.9 msm8953-qrd-sku3.dts.
// Changes include organization only; no regulator, GPIO or battery values are edited.
export function adaptTopLevelDts(source) {
  const oldPmic = '#include "msm-pmi8950.dtsi"';
  const sku = '#include "msm8953-qrd-sku3.dtsi"';
  if (source.split(oldPmic).length !== 2 || source.split(sku).length !== 2) throw new Error('Unexpected upstream top-level DTS anchors.');
  return source.replace(oldPmic, '#include "pmi8950.dtsi"')
    .replace(sku, sku + '\n#include "msm8953-pmi8950.dtsi"');
}

// Parser dependency fix: the legacy qrd overlay references labels introduced
// by the PMIC overlay. Resolve them before applying the qrd modifications.
export function adaptOverlayOrder(source) {
  const pmic = '#include "tbx704-msm-pmi8950.dtsi"';
  const qrd = '#include "tbx704-msm8953-qrd.dtsi"';
  if (source.split(pmic).length !== 2 || source.split(qrd).length !== 2) throw new Error('Unexpected overlay anchors.');
  if (source.indexOf(pmic) < source.indexOf(qrd)) throw new Error('PMIC overlay already ordered.');
  return source.replace(pmic, '').replace(qrd, pmic + '\n' + qrd);
}

// Compile probe only: 4.9 splits the old WCD codec into digital/analog nodes.
// This label mapping does NOT establish that audio controls/routing work.
export function adaptAudioLabels(source) {
  const mappings = [['&pm8953_diangu_dig', '&msm_digital_codec'], ['&pm8953_diangu_analog', '&pmic_analog_codec']];
  for (const [oldLabel, newLabel] of mappings) {
    if (source.split(oldLabel).length !== 2) throw new Error('Unexpected legacy audio label.');
    source = source.replace(oldLabel, newLabel);
  }
  return source;
}

// Merge the Lenovo override into the renamed 4.9 node at the same PMIC address.
// Keep the legacy vmax value; actuator behavior still requires a driver audit.
export function adaptHapticNode(source) {
  const oldNode = 'pmi_haptic: qcom,haptic@c000';
  if (source.split(oldNode).length !== 2) throw new Error('Unexpected legacy haptic node.');
  return source.replace(oldNode, 'pmi_haptic: qcom,haptics@c000');
}
