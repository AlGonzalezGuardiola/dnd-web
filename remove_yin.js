const fs = require('fs');

// characters.js
const charsFile = 'c:\\\\Users\\\\Alvaro\\\\dnd\\\\web\\\\characters.js';
let charsContent = fs.readFileSync(charsFile, 'utf8');
charsContent = charsContent.replace('window.characterData = ', '');
charsContent = charsContent.substring(0, charsContent.lastIndexOf(';'));
const charsObj = JSON.parse(charsContent);
delete charsObj['Yin'];
fs.writeFileSync(charsFile, 'window.characterData = ' + JSON.stringify(charsObj, null, 4) + ';', 'utf8');

// data.js
const dataFile = 'c:\\\\Users\\\\Alvaro\\\\dnd\\\\web\\\\data.js';
let dataContent = fs.readFileSync(dataFile, 'utf8');
dataContent = dataContent.replace('window.initialGameData = ', '');
dataContent = dataContent.substring(0, dataContent.lastIndexOf(';'));
const dataObj = JSON.parse(dataContent);

delete dataObj.mapas['YinvsCortes'];

// removing pines that go to YinvsCortes
for (const mapName in dataObj.mapas) {
    if (dataObj.mapas[mapName].pines) {
        dataObj.mapas[mapName].pines = dataObj.mapas[mapName].pines.filter(pin => pin.destino !== 'YinvsCortes' && !pin.nombre.includes('Yin'));
    }
}

fs.writeFileSync(dataFile, 'window.initialGameData = ' + JSON.stringify(dataObj, null, 4) + ';', 'utf8');
console.log("Done removing Yin");
