// Replace the removed Android wakelock API with actual kernel wakeup sources.
// GPIO, USB role, voltage and PD policy logic are not changed.
export function adaptFusbSource(relative, source) {
  const replacements = {
    'Platform_Linux/fusb30x_global.h': [
      ['#include <linux/wakelock.h>', '#include <linux/pm_wakeup.h>'],
      ['struct wake_lock fusb302_wakelock;', 'struct wakeup_source fusb302_wakelock;'],
    ],
    'Platform_Linux/platform_helpers.c': [
      ['#include <linux/wakelock.h>', '#include <linux/pm_wakeup.h>'],
      ['wake_lock_destroy(&chip->fusb302_wakelock);', 'wakeup_source_trash(&chip->fusb302_wakelock);'],
      ['wake_lock_init(&chip->fusb302_wakelock, WAKE_LOCK_SUSPEND, "fusb302wakelock");', 'wakeup_source_init(&chip->fusb302_wakelock, "fusb302wakelock");'],
      ['wake_lock(&chip->fusb302_wakelock);', '__pm_stay_awake(&chip->fusb302_wakelock);'],
      ['wake_unlock(&chip->fusb302_wakelock);', '__pm_relax(&chip->fusb302_wakelock);'],
    ],
  };
  if (!replacements[relative]) return source;
  for (const [before, after] of replacements[relative]) {
    if (source.split(before).length !== 2) throw new Error(`Unexpected FUSB wakeup API anchor: ${relative}`);
    source = source.replace(before, after);
  }
  return source;
}
