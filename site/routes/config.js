/* config.js: information related to global paths and variables */

/* paths */
let scriptsPath = '/home/rmn/sit/sitdesign/site/scripts/';
let filesPath   = '/home/rmn/sit/sitdesign/site/files/';

/* scripts */
let autoFEA    = scriptsPath + 'autofea.py';
let convertStl = scriptsPath + 'convert_to_stl.py';

module.exports = {
    scriptsPath: scriptsPath,
    filesPath: filesPath,
    autoFEA: autoFEA,
    convertStl: convertStl
};
