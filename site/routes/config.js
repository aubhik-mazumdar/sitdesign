/* config.js: information related to global paths and variables */

/* paths */
let scriptsPath = '/home/rmn/sit/sitdesign/site/scripts/';
let filesPath   = '/home/rmn/sit/sitdesign/site/files/';

/* scripts */
let autoFEA    = scriptsPath + 'autofea.py';
let convertStl = scriptsPath + 'convert_to_stl.py';

/* old values found in users.js -- might be useful for later */
// var autoFeaPath = '../scripts/autofea.py';
// var convertStlPath = '../scripts/convert_to_stl.py';
// var filesPath = '/opt/bitnami/apps/sitdesign/site/files/';
// var scriptsPath = '../scripts/';
// // var scriptsPath = '/opt/bitnami/apps/sitdesign/site/scripts/'


module.exports = {
    scriptsPath: scriptsPath,
    filesPath: filesPath,
    autoFEA: autoFEA,
    convertStl: convertStl
};
