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

## Verified CI results

- Full reference 4.9 kernel build: PASS, run [41243483124](https://github.com/mydloster/x704-ai-os/actions/runs/41243483124), job 124662010002. Image.gz-dtb SHA-256: `6a7a35f8a31bf93c4fb4eb75b15910b403bc1236de9b163d866a5ced298b0396`. This is the reference Xiaomi image; it was not uploaded as an artifact or flashed.
- Lenovo DTS compile after explicit adaptations: PASS, run [41243811412](https://github.com/mydloster/x704-ai-os/actions/runs/41243811412), with 163 compiler warnings retained for audit.
- Repeated Lenovo DTS compile plus structural audit: PASS, run [41244101774](https://github.com/mydloster/x704-ai-os/actions/runs/41244101774), job 124663832604. DTB SHA-256: `c6dff555a102ab07ebb111f93059106ace0b14681897337fd0154ef837186ffa`, 1,555 nodes. The audit found 12 same-parent unit-address groups; some are intentional shared resources or disabled alternatives. These are review candidates, not automatically 12 hardware conflicts.
- The merged DTB contains the intended Lenovo Goodix touch, FUSB302, both SDHCI controllers, qseecom at 0x83b00000, the reserved ramoops area, and merged haptics node. Their presence is not a driver/runtime test.
- 17 source/staging/gate/parser/PM migration tests pass in [source-check CI run 41244571048](https://github.com/mydloster/x704-ai-os/actions/runs/41244571048), including the guarded power-callback migration.

## Missing driver integration

Pinned reference tree listing is not truncated. It has no matching Lenovo couloMeter, FUSB302/onsemi tree, hall driver, or GF3206 driver. QPNP_FG is present under drivers/power/supply/qcom (renamed path, not absent); the original Lenovo qpnp-fg contains CONFIG_MACH_LENOVO_TBX704 conditionals and a couloMeter dependency. The reference's GF3208/C6 option does not establish GF3206 compatibility.

An isolated driver-object probe and original-defconfig resolution audit are now available in lenovo-driver-probe.yml. They do not integrate the driver into a boot image or validate battery reporting/charging.

The first driver probe failed on removed i2c_driver.suspend/resume fields. A guarded API migration registers dev_pm_ops wrappers that call the original functions; battery-register accesses and values are unchanged. [Probe 41244554770](https://github.com/mydloster/x704-ai-os/actions/runs/41244554770) compiled the object successfully. Object SHA-256: `ad0e8297edb5760683ec7c33df5f2fbdbf589069cf2698c6d7840e4bada82a5a`.

[Probe 41244743096](https://github.com/mydloster/x704-ai-os/actions/runs/41244743096) repeated the driver compile and tested changing the original CONFIG_ARCH_MSM=y to CONFIG_ARCH_QCOM=y. The resulting config retained ARCH_MSM8953=y without enabling MACH_XIAOMI. Differences against the old enabled settings fell from 198 to 132. These counts include changed defaults, renamed settings and dependency losses, not 132 proven missing drivers. QPNP_FG/QPNP_SMBCHARGER still remained disabled because the old config lacks the new MFD/SPMI dependency configuration. The driver-object test deliberately uses the known-buildable reference config instead; it does not hide this Lenovo configuration gap.

## Remaining checks

Hash verification is performed on all 17 original downloads before applying the explicit text adaptations. Existing checkout files are never overwritten. No power, battery, GPIO or voltage values are adjusted to silence the compiler. A DTB syntax pass alone cannot validate merged nodes, interrupt layout, charger behavior, panel initialization, touch rotation or proprietary HAL ABI.

Both Goodix implementations parse goodix,irq-gpio, goodix,rst-gpio and goodix,cfg-group%d and advertise goodix,gt9xx. This is only binding overlap. The legacy source contains a pen rotation helper, but its inspected call site is commented out; that helper alone is not evidence that a runtime rotation patch is required. Configuration, panel coordinates and actual multitouch behavior still need separate verification.

Before any test image: resolve the compiled Lenovo DTB review findings, select and integrate the Lenovo driver/config set, audit storage and nocmdq handling, and validate image format/signature and recovery. Full modern Android build capacity is still unresolved under the free-only requirement.

No new Android 12+ image has been built or flashed by these probes.
