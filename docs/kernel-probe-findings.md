# Kernel 4.9 compile probes — 2026-10-31

These probes do not produce a validated Lenovo kernel or Android ROM.
Reference source: zeelog/android_kernel_xiaomi_mido at d3baaff6d797893e6caea354b74ddf277ca62605.
Legacy Lenovo source: lukaspieper/android_kernel_lenovo_msm8953 at f21bb40e154a77e3e74da519e2477cf23a6fd261.

## Reproducible findings

- Source staging and release-gate tests: 8 passed locally and in GitHub run 41242215024. They do not test hardware.
- Initial reference compile lacked CROSS_COMPILE_ARM32. The runner now installs the ARM32 GCC/binutils package and supplies the prefix for the compat vDSO.
- Clang's newer debug information triggers repeated old-objdump DWARF warnings. A replacement run explicitly enables CONFIG_DEBUG_INFO_DWARF4, retaining debug information. The noisy run was canceled; it was not a successful build.
- Lenovo top-level DTS used msm-pmi8950.dtsi. The pinned 4.9 reference uses pmi8950.dtsi plus msm8953-pmi8950.dtsi. Only include organization was adapted.
- Next DTS run reached the compiler and failed on pmi8950_charger, pmi8950_fg, pm8953_diangu_dig and pm8953_diangu_analog.
- The first two labels are introduced in the Lenovo PMIC overlay, which originally occurs after their use in the qrd overlay. The probe now stages the PMIC overlay before qrd without changing its values.
- Legacy audio used two msm8x16_wcd_codec nodes at PMIC offsets f000/f100. The reference instead has a pmic-analog-codec covering f000..f1ff and an msm-digital-codec child at c0f0000. The probe maps enable-status references to those nodes. Audio routing and driver/HAL compatibility remain unverified.
- Upstream scripts/Makefile.lib adds -q three times to DTC_FLAGS, hiding the next error. The probe overrides DTC_FLAGS on the make command line and enables V=1; checks remain active and forced DTB output is not used.
- Revealed error: duplicate pmi_haptic label, because the legacy override uses qcom,haptic@c000 while 4.9 defines qcom,haptics@c000. The probe merges into the renamed node, retaining the original Lenovo vmax property. Driver semantics and actuator compatibility remain unverified.

## Limitations and next checks

Hash verification is performed on all 17 original downloads before applying the explicit text adaptations. Existing checkout files are never overwritten. No power, battery, GPIO or voltage values are adjusted to silence the compiler. A DTB syntax pass alone cannot validate merged nodes, interrupt layout, charger behavior, panel initialization, touch rotation or proprietary HAL ABI.

Both Goodix implementations parse goodix,irq-gpio, goodix,rst-gpio and goodix,cfg-group%d and advertise goodix,gt9xx. This is only binding overlap; the legacy driver has Lenovo coordinate handling that requires a separate audit.

Before any test image: finish reference compilation, inspect compiled Lenovo DTB for unintended inherited phone nodes and address conflicts, select the Lenovo driver/config set, audit storage and nocmdq handling, and validate image format/signature and recovery. Full modern Android build capacity is still unresolved under the free-only requirement.

No new Android 12+ image has been built or flashed by these probes.
