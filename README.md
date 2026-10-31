# X704 AI OS – Lenovo TB-X704L port research

Experimental development for Lenovo Tab 4 10 Plus TB-X704L. **No Android 12+ ROM has been built or verified for this tablet.**

## Verified results

- [17 source integration, staging, release-evidence and migration tests passed](https://github.com/mydloster/x704-ai-os/actions/runs/41244571048).
- [Full MSM8953 Linux 4.9.337 reference kernel compiled](https://github.com/mydloster/x704-ai-os/actions/runs/41243483124). This is the Xiaomi mido reference, not a Lenovo boot image.
- [Adapted Lenovo board DTS compiled and the merged DTB was structurally audited](https://github.com/mydloster/x704-ai-os/actions/runs/41244101774). Compiler warnings and address groups still need review; compilation does not establish hardware compatibility.
- [Isolated Lenovo coulometer battery-driver object compiled against 4.9 headers](https://github.com/mydloster/x704-ai-os/actions/runs/41244554770) after migrating I2C power callbacks to dev_pm_ops. Fuel-gauge integration, linking and runtime behavior remain unverified.

See [kernel probe findings](docs/kernel-probe-findings.md) for pinned revisions, image hashes, limitations and missing drivers. The workflows are reproducible compile/configuration probes, not flash instructions.

## Scope

Sources and workflows are published with the device owner's approval. This repository contains app/integration code, source references, guarded transformations and manually triggered CI workflows. It contains no device backups, private keys, private device reports, accounts or proprietary vendor binaries. Existing source copyrights remain applicable; no proprietary redistribution license is implied.

Standard public-repository runners only. No caches, build-artifact uploads, paid runners, cloud credentials, automatic flashing or full AOSP checkout. Private-repository jobs are disabled.

A working higher Android release still requires a complete Lenovo driver/kernel/device port, a suitable full-ROM build environment, and actual hardware/application acceptance tests. Passing these probes does not demonstrate boot, charging safety, streaming playback or DRM certification.
