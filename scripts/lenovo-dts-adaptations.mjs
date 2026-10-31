// Compile-probe adaptation derived from the reference 4.9 msm8953-qrd-sku3.dts.
// Changes include organization only; no regulator, GPIO or battery values are edited.
export function adaptTopLevelDts(source) {
  const oldPmic = '#include "msm-pmi8950.dtsi"';
  const sku = '#include "msm8953-qrd-sku3.dtsi"';
  if (source.split(oldPmic).length !== 2 || source.split(sku).length !== 2) throw new Error('Unexpected upstream top-level DTS anchors.');
  return source.replace(oldPmic, '#include "pmi8950.dtsi"')
    .replace(sku, sku + '\n#include "msm8953-pmi8950.dtsi"');
}
