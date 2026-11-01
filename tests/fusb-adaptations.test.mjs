import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptFusbSource} from '../scripts/lenovo-fusb-adaptations.mjs';

test('legacy USB wake lock becomes an actual embedded wakeup source',()=>{
  const input='#include <linux/wakelock.h>\nstruct wake_lock fusb302_wakelock;\nint gpio_UsbId;';
  const result=adaptFusbSource('Platform_Linux/fusb30x_global.h',input);
  assert.equal(result,'#include <linux/pm_wakeup.h>\nstruct wakeup_source fusb302_wakelock;\nint gpio_UsbId;');
  assert.throws(()=>adaptFusbSource('Platform_Linux/fusb30x_global.h',result));
});

test('wakeup migration preserves IRQ, GPIO, voltage and core policy code',()=>{
  const input='#include <linux/wakelock.h>\nvoid setup(){wake_lock_init(&chip->fusb302_wakelock, WAKE_LOCK_SUSPEND, "fusb302wakelock");}\nvoid irq(){wake_lock(&chip->fusb302_wakelock);\ncore_state_machine();\nfusb_GPIO_Set_UsbId(1);\nwake_unlock(&chip->fusb302_wakelock);}\nvoid cleanup(){wake_lock_destroy(&chip->fusb302_wakelock);}\n';
  const result=adaptFusbSource('Platform_Linux/platform_helpers.c',input);
  const calls=s=>s.split('\n').filter(l=>/core_state_machine|fusb_GPIO_Set_UsbId/.test(l));
  assert.deepEqual(calls(result),calls(input));
  assert.ok(result.includes('__pm_stay_awake(&chip->fusb302_wakelock)'));
  assert.ok(result.includes('__pm_relax(&chip->fusb302_wakelock)'));
  assert.ok(result.includes('wakeup_source_init(&chip->fusb302_wakelock, "fusb302wakelock")'));
  assert.ok(result.includes('wakeup_source_trash(&chip->fusb302_wakelock)'));
  assert.throws(()=>adaptFusbSource('Platform_Linux/platform_helpers.c',input+input));
  assert.equal(adaptFusbSource('core/TypeC.c',input),input);
});
