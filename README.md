# X704 AI OS – research and source checks

Experimental Lenovo TB-X704L development. No Android 12+ ROM has been built or verified for this tablet.

## Current results

- Sources and workflows published with the device owner's approval.
- [Source integration and release-evidence tests: passed](https://github.com/mydloster/x704-ai-os/actions/runs/41242215024).
- [MSM8953 4.9 reference compile probe](https://github.com/mydloster/x704-ai-os/actions/runs/41242238700): see the run for its current result. This is a Xiaomi mido reference, NOT a Lenovo kernel or flashable tablet image.

## Scope

This repository contains app/integration code, source references and manually triggered CI workflows. It contains no device backups, private keys, device reports, accounts or proprietary vendor binaries. Existing source copyrights remain applicable; no proprietary redistribution license is implied.

Standard public-repository runners only. No caches, build-artifact uploads, paid runners, cloud credentials, automatic flashing or full AOSP checkout. Private-repository jobs are disabled. Free compute availability and successful compilation are not guaranteed.

A working higher Android release requires a real Lenovo board/kernel port, a suitable complete-ROM build environment and actual hardware/application acceptance tests. Passing source checks does not demonstrate those results.
