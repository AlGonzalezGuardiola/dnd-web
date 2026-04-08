/**
 * Seed: Bolso de Hermione
 * Ejecutar: node server/seed-inventario.js
 * Reemplaza completamente el inventario con los objetos de la campaña.
 */

const http  = require('http');
const https = require('https');

const BASE  = process.env.API_URL || 'http://localhost:3001';
const ID    = '__bolso_hermione__';
const ts    = Date.now();
let   i     = 0;
const id    = () => `seed_${++i}_${ts}`;

const ITEMS = [
    // ── ORO ──────────────────────────────────────────────────
    { id: id(), nombre: 'Monedas de oro',                   cantidad: 10000, categoria: 'oro',        desc: null,  img: null, ts },

    // ── COMIDA ───────────────────────────────────────────────
    { id: id(), nombre: 'Caldero de comida rica',           cantidad: 1,     categoria: 'comida',     desc: null,  img: null, ts },
    { id: id(), nombre: 'Jamón de ciervo',                  cantidad: 2,     categoria: 'comida',     desc: null,  img: null, ts },
    { id: id(), nombre: 'Chorizo de ciervo',                cantidad: 2,     categoria: 'comida',     desc: null,  img: null, ts },
    { id: id(), nombre: 'Salchichón de ciervo',             cantidad: 6,     categoria: 'comida',     desc: null,  img: null, ts },
    { id: id(), nombre: 'Carne de RinoInfernal',            cantidad: 975,   categoria: 'comida',     desc: '975 kg', img: null, ts },
    { id: id(), nombre: 'Vegetales',                        cantidad: 400,   categoria: 'comida',     desc: '400 kg', img: null, ts },
    { id: id(), nombre: 'Cebada de Jamie',                  cantidad: 1,     categoria: 'comida',     desc: null,  img: null, ts },
    { id: id(), nombre: 'Tuppers de migas con panceta, chorizo y huevo', cantidad: 1, categoria: 'comida', desc: null, img: null, ts },

    // ── ARMAS ────────────────────────────────────────────────
    { id: id(), nombre: 'Espadas normales',                 cantidad: 5,     categoria: 'armas',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Dagas',                            cantidad: 4,     categoria: 'armas',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Arcos',                            cantidad: 3,     categoria: 'armas',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Espada élfica',                    cantidad: 1,     categoria: 'armas',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Espadas cortas',                   cantidad: 2,     categoria: 'armas',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Guadaña',                          cantidad: 1,     categoria: 'armas',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Espada hada',                      cantidad: 1,     categoria: 'armas',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Armadura del guerrero hada',       cantidad: 1,     categoria: 'armas',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Arco hada',                        cantidad: 1,     categoria: 'armas',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Guantes de Rudo',                  cantidad: 1,     categoria: 'armas',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Espadas de Morgona',               cantidad: 6,     categoria: 'armas',      desc: '1d10 + 2d6 necrótico', img: null, ts },

    // ── IMPORTANTE ───────────────────────────────────────────
    { id: id(), nombre: 'Gemas elementales',                cantidad: 4,     categoria: 'importante', desc: 'Gema Negra, Azul, Roja y Blanca', img: null, ts },
    { id: id(), nombre: 'Ganzúas irrompibles',              cantidad: 5,     categoria: 'importante', desc: null,  img: null, ts },
    { id: id(), nombre: 'Huevos de monturas',               cantidad: 4,     categoria: 'importante', desc: null,  img: null, ts },
    { id: id(), nombre: 'Incubadora para los huevos',       cantidad: 1,     categoria: 'importante', desc: null,  img: null, ts },
    { id: id(), nombre: 'Cuernos de RinoInfernal',          cantidad: 3,     categoria: 'importante', desc: null,  img: null, ts },
    { id: id(), nombre: 'Trono de mazmorra',                cantidad: 1,     categoria: 'importante', desc: null,  img: null, ts },
    { id: id(), nombre: 'Gema de Jaice',                    cantidad: 1,     categoria: 'importante', desc: null,  img: null, ts },
    { id: id(), nombre: 'Aro portal Tharun',                cantidad: 1,     categoria: 'importante', desc: null,  img: null, ts },
    { id: id(), nombre: 'Tarjetas de visita de Iñaki',      cantidad: 1,     categoria: 'importante', desc: null,  img: null, ts },

    // ── POCIONES ─────────────────────────────────────────────
    { id: id(), nombre: 'Poción de cura (1d4)',             cantidad: 2,     categoria: 'pociones',   desc: 'Recupera 1d4 puntos de golpe', img: null, ts },
    { id: id(), nombre: 'Poción de cura (2d4)',             cantidad: 4,     categoria: 'pociones',   desc: 'Recupera 2d4 puntos de golpe', img: null, ts },
    { id: id(), nombre: 'Poción Troll',                     cantidad: 4,     categoria: 'pociones',   desc: 'Regenera 1d4 PG por turno durante el combate', img: null, ts },
    { id: id(), nombre: 'Poción de veneno (3d6)',           cantidad: 4,     categoria: 'pociones',   desc: 'Causa 3d6 de daño por veneno', img: null, ts },
    { id: id(), nombre: 'Ácido para envenenar arma',        cantidad: 1,     categoria: 'pociones',   desc: 'Envenena un arma: 1d6 veneno adicional por golpe', img: null, ts },
    { id: id(), nombre: 'Poción de CA +2',                  cantidad: 3,     categoria: 'pociones',   desc: 'Aumenta la Clase de Armadura en +2 durante 1 hora', img: null, ts },

    // ── PERGAMINOS ───────────────────────────────────────────
    { id: id(), nombre: 'Pergamino de Revivir',             cantidad: 2,     categoria: 'pergaminos', desc: null,  img: null, ts },
    { id: id(), nombre: 'Pergamino de Teleportación',       cantidad: 1,     categoria: 'pergaminos', desc: null,  img: null, ts },

    // ── OTRAS COSAS ──────────────────────────────────────────
    { id: id(), nombre: 'Documentos Jaice',                 cantidad: 1,     categoria: 'otras',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Hierba de Jamie',                  cantidad: 1,     categoria: 'otras',      desc: '450 g', img: null, ts },
    { id: id(), nombre: 'Setas',                            cantidad: 4,     categoria: 'otras',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Tabla visión de la muerte',        cantidad: 1,     categoria: 'otras',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Figura de guardianes fantasmas vigilantes', cantidad: 1, categoria: 'otras', desc: null,  img: null, ts },
    { id: id(), nombre: 'Lengua de Hethrow',                cantidad: 1,     categoria: 'otras',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Cola de Hethrow',                  cantidad: 1,     categoria: 'otras',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Pieles de lobo infernal',          cantidad: 1,     categoria: 'otras',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Jabalinas',                        cantidad: 5,     categoria: 'otras',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Ballesta',                         cantidad: 1,     categoria: 'otras',      desc: null,  img: null, ts },
    { id: id(), nombre: 'Maza de hueso',                    cantidad: 1,     categoria: 'otras',      desc: '1d10 de daño contundente', img: null, ts },
    { id: id(), nombre: 'Espada Larga de Tumulario',        cantidad: 1,     categoria: 'otras',      desc: '1d8 cortante + 1d8 necrótico + Destreza. Cada golpe reduce la vida máxima en el daño necrótico causado.', img: null, ts },
    { id: id(), nombre: 'Colas y Garras de Otyhud',         cantidad: 1,     categoria: 'otras',      desc: null,  img: null, ts },
];

// ── HTTP helper ──────────────────────────────────────────────
function request(method, url, body) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib    = parsed.protocol === 'https:' ? https : http;
        const data   = body ? JSON.stringify(body) : null;
        const opts   = {
            hostname: parsed.hostname,
            port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path:     parsed.pathname,
            method,
            headers:  { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
        };
        const req = lib.request(opts, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
    console.log(`\n🎒 Seed: Bolso de Hermione → ${BASE}\n`);

    const res = await request('PUT', `${BASE}/api/player-characters/${ID}`, { data: { items: ITEMS } });

    if (res.success) {
        console.log(`✅ Inventario cargado: ${ITEMS.length} objetos`);
    } else {
        console.error('❌ Error:', res);
        process.exit(1);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
