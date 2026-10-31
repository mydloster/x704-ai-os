// API-only compile migration. Battery registers, conversion logic and values
// remain untouched. This does not integrate the driver with the 4.9 fuel gauge.
export function adaptCoulometerPm(source) {
  function replaceOne(anchor, replacement) {
    if (source.split(anchor).length !== 2) throw new Error('Unexpected legacy coulometer PM anchor');
    source = source.replace(anchor, replacement);
  }
  if (source.includes('cm_pm_ops')) throw new Error('Coulometer PM migration already applied');
  replaceOne('#include <linux/module.h>', '#include <linux/module.h>\n#include <linux/pm.h>');
  replaceOne('static struct i2c_driver CM_i2c_driver = {',
    'static int cm_pm_suspend(struct device *dev)\n{\n\treturn cm_i2c_suspend(to_i2c_client(dev), PMSG_SUSPEND);\n}\n\n' +
    'static int cm_pm_resume(struct device *dev)\n{\n\treturn cm_i2c_resume(to_i2c_client(dev));\n}\n\n' +
    'static SIMPLE_DEV_PM_OPS(cm_pm_ops, cm_pm_suspend, cm_pm_resume);\n\n' +
    'static struct i2c_driver CM_i2c_driver = {');
  replaceOne('.of_match_table = couloMeter_of_match,', '.of_match_table = couloMeter_of_match,\n\t\t.pm = &cm_pm_ops,');
  replaceOne('\t.suspend     = cm_i2c_suspend,\n', '');
  replaceOne('\t.resume      = cm_i2c_resume,\n', '');
  return source;
}
