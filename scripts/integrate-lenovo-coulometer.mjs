// Kbuild integration only. Does not port Lenovo's fuel-gauge customizations.
import fs from 'node:fs';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Pass the disposable 4.9 kernel checkout');
const root = path.resolve(process.argv[2]);
const version = fs.readFileSync(path.join(root, 'Makefile'), 'utf8');
if (!/^VERSION\s*=\s*4$/m.test(version) || !/^PATCHLEVEL\s*=\s*9$/m.test(version)) throw new Error('Expected kernel 4.9');
const directory = path.join(root, 'drivers/power/supply/qcom');
const makefile = path.join(directory, 'Makefile'), kconfig = path.join(directory, 'Kconfig');
const make = fs.readFileSync(makefile, 'utf8'), conf = fs.readFileSync(kconfig, 'utf8');
const localConfig = path.join(directory, 'x704-coulometer/Kconfig');
if (make.includes('x704-coulometer') || conf.includes('x704-coulometer') || fs.existsSync(localConfig)) throw new Error('Integration already present');
for (const name of ['couloMeter.c','couloMeter.h','Makefile']) {
  if (!fs.existsSync(path.join(directory,'x704-coulometer',name))) throw new Error('Stage the hash-verified Lenovo driver first');
}
const ownConfig = 'config X704_COULOMETER\n\tbool "Experimental Lenovo TB-X704 coulometer"\n\tdepends on I2C && ARCH_MSM8953\n\thelp\n\t  Compile-port of the legacy Lenovo I2C battery gauge driver.\n\t  Fuel-gauge integration and hardware behavior are not yet validated.\n';
fs.writeFileSync(localConfig, ownConfig, {flag:'wx'});
fs.writeFileSync(makefile, make + '\n# X704 compile-port integration\nobj-$(CONFIG_X704_COULOMETER) += x704-coulometer/\n');
fs.writeFileSync(kconfig, conf + '\nsource "drivers/power/supply/qcom/x704-coulometer/Kconfig"\n');
console.log('Integrated the experimental Lenovo coulometer into Kbuild. No fuel-gauge logic or charging values modified.');
