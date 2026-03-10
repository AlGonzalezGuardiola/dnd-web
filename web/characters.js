window.characterData = {
    "Vel": {
        "id": "Vel",
        "tipo": "jugador",
        "segundaAccion": true,
        "nombre": "Vel'Rhazal Vardros",
        "raza": "Humano Demonio",
        "clase": "Brujo (Hexblade)",
        "nivel": 5,
        "fondo": "Criminal",
        "imagen": "assets/imagenes/Vel_profile_pic.jpg",
        "imagenScale": 1,
        "stats": {
            "Fuerza": 8,
            "Destreza": 16,
            "Constitución": 16,
            "Inteligencia": 10,
            "Sabiduría": 12,
            "Carisma": 20
        },
        "resumen": {
            "HP": "43",
            "CA": "17",
            "Iniciativa": "+3",
            "Velocidad": "30ft",
            "Competencia": "+3"
        },
        "habilidades": [
            "Arcanos",
            "Intimidación",
            "Persuasión",
            "Juego de Manos"
        ],
        "rasgos": [
            {
                "nombre": "🗡️ Pacto del Filo (Hexblade)",
                "desc": "Arma invocada/teletransportada a voluntad. Usa CAR para ataque/daño. Solo tú puedes usar su potencial."
            },
            {
                "nombre": "🩸 Recuperación Oscura",
                "desc": "Al reducir a 0 HP hostil: Ganas HP Temp = Mod CAR + Nivel."
            },
            {
                "nombre": "🔮 Invocaciones Sobrenaturales",
                "desc": "<strong>Estallido Agonizante:</strong> +CAR al daño de Eldritch Blast.<br><strong>Estallido Repulsor:</strong> Empuja 10ft al golpear.<br><strong>Influencia Seductora:</strong> Comp. Engaño y Persuasión."
            },
            {
                "nombre": "👹 Aura Demoníaca (Transformación)",
                "desc": "Duración: 6 turnos. Efectos:<br>+2 CA.<br>Velocidad 50ft.<br>+1d8 necrótico extra por ataque.<br>Inmune a Hechizar y Ralentizar."
            },
            {
                "nombre": "⚔️ Espada Demoníaca (Objeto)",
                "desc": "Daño: 1d10 cort + 1d4 necrótico.<br><strong>Aura Necrótica (1/Largo - 1 min):</strong> Radio 30ft (móvil).<br>Al activar: TS CAR (CD 8+comp+CAR) o Asustado.<br>Terreno difícil dentro.<br>Al intentar salir: TS CON o 1d8 necrótico.<br>Inicio de turno dentro: 1d12 necrótico.<br>TODO daño necrótico dentro duplica sus dados."
            },
            {
                "nombre": "🧣 Bufanda de Araña (Objeto)",
                "desc": "Mano de Mago a voluntad (60ft)."
            },
            {
                "nombre": "🪞 Espejo Vampírico (Objeto)",
                "desc": "2 Horrocruxes. Si caes a 0 HP → Espectro con 1 HP (salvo fuego/divino).<br><strong>TP Espejos:</strong> A voluntad a tus espejos o cualquier superficie reflectante."
            },
            {
                "nombre": "📜 Don de Lenguas",
                "desc": "Lees cualquier escritura a voluntad. Hablas/entiendes cualquier idioma 1/Largo."
            },
            {
                "nombre": "👿 Enemigo Predilecto: Demonios",
                "desc": "Contra demonios, rompes sus defensas:<br>Inmune → Resistente → Neutro → Débil."
            },
            {
                "nombre": "🚫 Antimagia",
                "desc": "Trucos y conjuros nivel 1 que te toquen o acerquen se desvanecen.<br>Conjuros de mayor nivel: el lanzador debe superar una TS o el hechizo no surte efecto."
            }
        ],
        "ranuras": [
            { "nombre": "Pacto (Nv3)", "total": 2 }
        ],
        "conjuros": [
            {
                "nombre": "Estallido Arcano (Melee)",
                "nivel": "Truco",
                "desc": "2d10 fuerza imbuid. en espada + CAR. Bonus. (+Empuje 10ft)."
            },
            {
                "nombre": "Escudo de Fe",
                "nivel": "Esp",
                "desc": "+2 CA. Bonus. Concentración. 3 usos/Largo."
            },
            {
                "nombre": "Sirviente Invisible",
                "nivel": "Esp",
                "desc": "1/día gratis. 1 hora. Invisible → ventaja en ataques. 1 PG.<br>Atq acción: 1d8 divino +CAR (+7). Atq bonus: 1d4 + ventaja al sig. atacante."
            },
            {
                "nombre": "Orden Imperiosa",
                "nivel": 3,
                "desc": "1 palabra. SAB Save. Acción."
            },
            {
                "nombre": "Ceguera/Sordera",
                "nivel": 3,
                "desc": "CON Save. Ciego o Sordo. Puede repetir TS final de turno."
            },
            {
                "nombre": "Hex / Mal de Ojo",
                "nivel": 3,
                "desc": "Bonus. Concentración. +1d6 necrótico al golpear + Desventaja en stat elegida. Cambia objetivo al matar."
            },
            {
                "nombre": "Paso Brumoso",
                "nivel": 3,
                "desc": "Teletransporte 30ft. Bonus."
            },
            {
                "nombre": "Inmovilizar Persona",
                "nivel": 3,
                "desc": "SAB Save o Paralizado. Ataques en melé = crítico auto. Concentración."
            },
            {
                "nombre": "Patrón Hipnótico",
                "nivel": 3,
                "desc": "Cubo 30ft. TS SAB o Incapacitado + velocidad 0. Se rompe con daño o acción de aliado. Concentración 1 min."
            },
            {
                "nombre": "Toque Vampírico",
                "nivel": 3,
                "desc": "Ataque CaC. 3d6 necrótico. Te curas mitad del daño. Concentración 1 min."
            },
            {
                "nombre": "Contrahechizo",
                "nivel": "Reac",
                "desc": "Anula conjuro enemigo al lanzarse. Nivel 3 o inferior: automático."
            },
            {
                "nombre": "Forma Gaseosa",
                "nivel": 3,
                "desc": "Te conviertes en niebla. Vuelo lento, atraviesas rendijas, muy difícil de dañar. No atacas ni lanzas. Concentración 1 h."
            }
        ],
        "combateExtra": [
            {
                "nombre": "Espada Demoníaca",
                "tipo": "accion",
                "atk": "1d20+8",
                "dado": "1d10+1d4+5",
                "tipo_dano": "cortante/necrótico",
                "desc": "Cort/Necr. +1d8 necrótico en Forma Demoníaca. Aura Necrótica activa dobla dados necróticos."
            }
        ]
    },
    "Zero": {
        "id": "Zero",
        "tipo": "jugador",
        "nombre": "Zero",
        "raza": "Warforged",
        "clase": "Mago Invocador del Vacío",
        "nivel": 5,
        "fondo": "Artesano",
        "imagen": "assets/imagenes/Zero_profile_pic.jpg",
        "imagenScale": 1,
        "stats": {
            "Fuerza": 8,
            "Destreza": 14,
            "Constitución": 16,
            "Inteligencia": 18,
            "Sabiduría": 12,
            "Carisma": 10
        },
        "resumen": {
            "HP": "37",
            "CA": "19",
            "Iniciativa": "+2",
            "Velocidad": "30ft",
            "Competencia": "+3"
        },
        "habilidades": [
            "Investigación",
            "Medicina",
            "Juego de Manos",
            "Arcanos"
        ],
        "rasgos": [
            {
                "nombre": "🔥 Afinidad Necrótica",
                "desc": "Acceso a Nigromancia. Hechizos necróticos: +20ft alcance, añade +INT al daño."
            },
            {
                "nombre": "💀 Eco de la Muerte (1/día)",
                "desc": "Al matar enemigo: Cura 1d6 por nivel (4d6)."
            },
            {
                "nombre": "🌑 Sello del Vacío (1/Largo)",
                "desc": "Esfera 15ft de oscuridad absoluta en una invocación. 1 min. Nada se ve dentro/fuera. Invocaciones ganan bufos."
            },
            {
                "nombre": "🕷️ Invocación: Diablillo Ígneo",
                "desc": "HP 22 | CA 13 | Vuelo 30ft.<br><strong>Atq:</strong> +5 (1d4+3 + 1d6 fuego).<br><strong>Lluvia Ígnea (2/día):</strong> Línea 5x20ft, DEX CD 13, 1d6 fuego + quemadura.<br><strong>En Sello:</strong> +10HP, +1d6 fuego atq, Detonación en área (3d6 fuego)."
            },
            {
                "nombre": "🕸️ Invocación: Araña Etérea",
                "desc": "HP 25 | CA 14 | Trepar.<br><strong>Atq:</strong> +5 (1d8+2 + 1d6 veneno).<br><strong>Red (2/día):</strong> 20ft área, Inmoviliza (CD 13).<br><strong>En Sello:</strong> +10HP, +1d8 atq, Veneno/Necrótico en área (1d6+1d6)."
            },
            {
                "nombre": "🛡️ Invocación: Moscosidad Defensiva",
                "desc": "HP 40 | CA 16. Inmune cortante/contondente.<br><strong>Atq:</strong> 2d6 cont.<br><strong>Muro de Carne (Reacción):</strong> Absorbe daño de Zero.<br><strong>En Sello:</strong> +20HP, +1d6 daño, Crea copias al recibir golpe."
            },
            {
                "nombre": "🩸 Invocación: Sanguinario del Olvido",
                "desc": "HP 33 | CA 15.<br><strong>Atq:</strong> +6 (2d6 perf + 1d6 necrótico). Recupera HP.<br><strong>Interrupción Vital (Reacción):</strong> Counterspell + daño.<br><strong>En Sello:</strong> +15HP, Campo Antimagia menor."
            },
            {
                "nombre": "🌑 Bastón de la Mano Prohibida",
                "desc": "+2 tiradas de ataque y CD. Daño adicional: 1d12 necrótico.<br><strong>Magias de Sombras (1/día):</strong> Lanza un hechizo de sombras sin gastar ranura.<br><strong>Crítico Necrótico (18-19):</strong> El daño necrótico del bastón es crítico con 18-19.<br><strong>Represión Infernal (Reacción):</strong> 2d10 fuego/necrótico al recibir daño. Recupera slots (N1/3 turnos)."
            },
            {
                "nombre": "👻 Capa Espectral y Brazalete",
                "desc": "Caída de Plumas, Volar.<br><strong>Brazalete (Bonus):</strong> 1 turno Intangible, Inmune daño no mágico, atraviesa paredes."
            }
        ],
        "ranuras": [
            { "nombre": "Nv1", "total": 4 },
            { "nombre": "Nv2", "total": 3 },
            { "nombre": "Nv3", "total": 2 }
        ],
        "conjuros": [
            {
                "nombre": "Infligir Heridas",
                "nivel": 1,
                "desc": "3d10 necrótico + INT (Melee/20ft)."
            },
            {
                "nombre": "Misil Mágico",
                "nivel": 1,
                "desc": "3x (1d4+1). Auto-hit."
            },
            {
                "nombre": "Grasa",
                "nivel": 1,
                "desc": "Área 10ft, caer al suelo (DEX)."
            },
            {
                "nombre": "Dormir",
                "nivel": 1,
                "desc": "5d8 HP afectados."
            },
            {
                "nombre": "Rayo Abrasador",
                "nivel": 2,
                "desc": "3 rayos, 2d6 fuego cada uno."
            },
            {
                "nombre": "Imagen Múltiple",
                "nivel": 2,
                "desc": "3 duplicados defensivos."
            },
            {
                "nombre": "Inmovilizar Persona",
                "nivel": 2,
                "desc": "Paraliza humanoide (SAB CD 13)."
            },
            {
                "nombre": "Orbe Devastador",
                "nivel": 2,
                "desc": "Proyectil de energía oscura. 2d8 necrótico + INT. Impacto reduce velocidad 10ft hasta siguiente turno."
            },
            {
                "nombre": "Cambio de Vida",
                "nivel": 2,
                "desc": "Transfiere HP entre dos criaturas a 30ft. Una pierde hasta 4d6 HP, la otra los recupera."
            },
            {
                "nombre": "Invisibilidad",
                "nivel": 2,
                "desc": "1 hora o hasta atacar."
            },
            {
                "nombre": "Susurros del Olvido",
                "nivel": "Esp",
                "desc": "3d6 psíquico + Huir (SAB)."
            },
            {
                "nombre": "🩸 Dagas de Sangre (Bonus)",
                "nivel": "Esp",
                "desc": "-5 HP per se. Crea daga 1d6. Acertar crea otra."
            },
            {
                "nombre": "⚡ Convergencia (Bonus)",
                "nivel": "Esp",
                "desc": "Cambia tipo daño siguiente hechizo + 1d6."
            },
            {
                "nombre": "⛓️ Cadenas del Vacío (Reacción)",
                "nivel": "Esp",
                "desc": "60-80ft. Inmoviliza (SAB CD 13) + 2d6 necrótico/turno."
            }
        ],
        "combateExtra": [
            {
                "nombre": "Bastón Prohibido",
                "tipo": "accion",
                "atk": "1d20+9",
                "dado": "1d6+1d12+4",
                "tipo_dano": "necrótico",
                "desc": "Báculo mágico. Crítico necrótico con 18-19. +INT al daño."
            },
            {
                "nombre": "Represión Infernal",
                "tipo": "reaccion",
                "dado": "2d10",
                "tipo_dano": "fuego/necrótico",
                "desc": "Reacción al recibir daño. 2d10 fuego o necrótico al atacante. Recupera slots (Nv1/3 turnos)."
            },
            {
                "nombre": "Brazalete (Intangible)",
                "tipo": "adicional",
                "dado": "—",
                "desc": "1 turno intangible: Inmune a daño no mágico, atraviesas paredes."
            }
        ],
        "invocaciones": [
            {
                "id": "diablillo",
                "nombre": "Diablillo Ígneo",
                "emoji": "🕷️",
                "hp": 22,
                "ca": 13,
                "velocidad": "Vuelo 30ft",
                "ataque": "+5 (1d4+3 + 1d6 fuego)",
                "habilidades": [
                    "Lluvia Ígnea (2/día): Línea 5×20ft, DEX CD 13, 1d6 fuego + quemadura.",
                    "En Sello del Vacío: +10HP, +1d6 fuego, Detonación en área (3d6 fuego)."
                ]
            },
            {
                "id": "arana",
                "nombre": "Araña Etérea",
                "emoji": "🕸️",
                "hp": 25,
                "ca": 14,
                "velocidad": "Trepar",
                "ataque": "+5 (1d8+2 + 1d6 veneno)",
                "habilidades": [
                    "Red (2/día): 20ft área, Inmoviliza (CD 13).",
                    "En Sello del Vacío: +10HP, +1d8 atq, Veneno/Necrótico en área."
                ]
            },
            {
                "id": "moscosidad",
                "nombre": "Moscosidad Defensiva",
                "emoji": "🛡️",
                "hp": 40,
                "ca": 16,
                "velocidad": "30ft",
                "ataque": "2d6 contundente",
                "habilidades": [
                    "Inmune a daño cortante y contundente.",
                    "Muro de Carne (Reacción): Absorbe daño de Zero.",
                    "En Sello del Vacío: +20HP, +1d6 daño, crea copias al recibir golpes."
                ]
            },
            {
                "id": "sanguinario",
                "nombre": "Sanguinario del Olvido",
                "emoji": "🩸",
                "hp": 33,
                "ca": 15,
                "velocidad": "30ft",
                "ataque": "+6 (2d6 perf + 1d6 necrótico). Recupera HP.",
                "habilidades": [
                    "Interrupción Vital (Reacción): Counterspell + daño.",
                    "En Sello del Vacío: +15HP, Campo Antimagia menor."
                ]
            }
        ]
    },
    "Asthor": {
        "id": "Asthor",
        "tipo": "jugador",
        "segundaAccion": true,
        "nombre": "Asthor, Martillo Argento",
        "raza": "Enano",
        "clase": "Paladín",
        "nivel": 5,
        "fondo": "Soldado",
        "imagen": "assets/imagenes/Asthor_profile_pic.jpg",
        "imagenScale": 1,
        "stats": {
            "Fuerza": 18,
            "Destreza": 8,
            "Constitución": 16,
            "Inteligencia": 10,
            "Sabiduría": 12,
            "Carisma": 14
        },
        "resumen": {
            "HP": "49",
            "CA": "23",
            "Iniciativa": "-1",
            "Velocidad": "25ft",
            "Competencia": "+3"
        },
        "habilidades": [
            "Atletismo",
            "Perspicacia",
            "Religión",
            "Herrería (Runas)"
        ],
        "rasgos": [
            {
                "nombre": "🔨 Martillo Infernal",
                "desc": "Daño: 1d10 + Fuerza + 1d6 fuego.<br><strong>Lanzamiento (30ft):</strong> Ataque normal. <strong>TP (Bonus):</strong> Te teletransportas al martillo. Enemigos a 10ft hacen DEX Save o caen al suelo + 1d4 fuerza.<br><strong>Retorno:</strong> Vuelve a tu mano (mentalmente si <=30ft)."
            },
            {
                "nombre": "🛡️ Escudo de la Doncella Abismal",
                "desc": "<strong>Velo de la Doncella (1/día, Reacción):</strong> Inmunidad total a un ataque o hechizo dirigido a ti. Puedes activarlo tras ver el resultado.<br><strong>Lamento del Abismo (1/día):</strong> Cono 30ft. 2d8 necrótico + 2d8 psíquico (CON Save mitad)."
            },
            {
                "nombre": "👻 Armadura Guardián Planar y Modo Guardián",
                "desc": "Pasivo: +1 CA, Resistencia Fuego.<br><strong>Modo Guardián:</strong> Se activa al recibir daño 3 veces. Dura 3 turnos. Avatar gigante (10x10x30ft). <strong>Efecto:</strong> Daño, Modificadores y HP se DUPLICAN. Inmune a daño no mágico. Alcance 20ft."
            },
            {
                "nombre": "⚔️ Ventaja Vengadora",
                "desc": "Si fallas un ataque, tienes ventaja en el siguiente ataque contra la misma criatura."
            },
            {
                "nombre": "🛡️ Venganza del Guardián",
                "desc": "Reacción: Si un aliado a 5ft recibe daño, puedes hacer un ataque contra el atacante."
            },
            {
                "nombre": "🪨 Corazón de Piedra",
                "desc": "Moldear roca/piedra a 60ft (Acción/Bonus/Reacción)."
            },
            {
                "nombre": "💥 Ataque Enano (1/día)",
                "desc": "Área 5ft. STR Save. Fallo: Empuje 10ft + 1d10 fuerza. Choque: +2d6 y aturdido 1 turno."
            },
            {
                "nombre": "✨ Sentido Divino (3 usos)",
                "desc": "Detectas celestiales, demonios y no-muertos a 60 ft."
            },
            {
                "nombre": "✋ Imposición de Manos",
                "desc": "Reserva: 20 PG. 5 puntos curan veneno/enfermedad."
            },
            {
                "nombre": "⚛️ Núcleo de Antimateria (Objeto)",
                "desc": "1/día. Tira 1d100.<br><strong>30+:</strong> Nada.<br><strong>20-:</strong> Catástrofe.<br><strong>1. Repulsión (Reacción):</strong> Nadie puede acercarse a 30ft por 3 turnos.<br><strong>2. Aniquilación:</strong> Tu ataque es crítico auto (o mitad daño si fallas).<br><strong>3. Cuerpo Antimateria:</strong> Intangible 1 turno. Toque desintegra. 10ft área hacen 3d12 fuerza (DEX Save)."
            },
            {
                "nombre": "🌕 Luminario (Objeto)",
                "desc": "Luz 40ft (disipa oscuridad mágica).<br><strong>Juicio (1/día):</strong> Cura 4 aliados (4d8+CHA). Enemigos TS SAB: Daño radiante igual a la cura."
            },
            {
                "nombre": "🪨 Runas Enanas",
                "desc": "<strong>Espalda:</strong> +2 STR, Comp. STR Save.<br><strong>Brazo:</strong> Ataques empujan 10ft.<br><strong>Mano:</strong> +2 CD inmovilizar.<br><strong>Conjuro Rúnico (Bonus):</strong> Toque, STR Save o Inmovilizado en piedra + 1d10 fuerza."
            },
            {
                "nombre": "🌟 Runas Divinas",
                "desc": "Passivo: +2 SAB, Comp. SAB Save. 1/día Cura 2d6 (+1d8 divino a ataques).<br><strong>Hechizo rúnico (Bonus):</strong> Cura 1d4 a 4 criaturas."
            }
        ],
        "ranuras": [
            { "nombre": "Nv1", "total": 4 },
            { "nombre": "Nv2", "total": 2 }
        ],
        "conjuros": [
            {
                "nombre": "Divine Smite (Class)",
                "nivel": "Especial",
                "desc": "2d8 Radiante + 1d8/nivel extra al impactar. Gratuitos = Mitad de slots."
            },
            {
                "nombre": "Bendecir",
                "nivel": 1,
                "desc": "+1d4 ataques/saves (3 objetivos)."
            },
            {
                "nombre": "Curar Heridas",
                "nivel": 1,
                "desc": "1d8 + Mod curación."
            },
            {
                "nombre": "Escudo de Fe",
                "nivel": 1,
                "desc": "+2 CA (Bonus)."
            },
            {
                "nombre": "Heroísmo",
                "nivel": 1,
                "desc": "Inmune miedo, HP temp."
            },
            {
                "nombre": "Duelo Obligado",
                "nivel": 1,
                "desc": "Enemigo debe atacarte."
            },
            {
                "nombre": "Command",
                "nivel": 1,
                "desc": "Orden simple."
            },
            {
                "nombre": "Divine Favor",
                "nivel": 1,
                "desc": "+1d4 radiante (Bonus)."
            },
            {
                "nombre": "Searing Smite",
                "nivel": 1,
                "desc": "1d6 fuego + quemadura (Bonus)."
            },
            {
                "nombre": "Wrathful Smite",
                "nivel": 1,
                "desc": "1d6 psíquico + Miedo (Bonus)."
            },
            {
                "nombre": "Thunderous Smite",
                "nivel": 1,
                "desc": "2d6 trueno + Empuje/Prone (Bonus)."
            },
            {
                "nombre": "Moonbeam",
                "nivel": 2,
                "desc": "Columna de luz 5ft radio, 40ft alto. 2d10 radiante/turno (CON Save mitad). Concentración 1 min."
            },
            {
                "nombre": "Detectar Magia / Bien y Mal",
                "nivel": 1,
                "desc": "Utilidad."
            }
        ],
        "combateExtra": [
            {
                "nombre": "Martillo Infernal (Melé)",
                "tipo": "accion",
                "atk": "1d20+7",
                "dado": "1d10+1d6+4",
                "tipo_dano": "contundente/fuego",
                "desc": "Cont + 1d6 fuego. Ataques empujan 10ft (Runas). Si choca contra pared: +2d6 y aturdido 1 turno."
            },
            {
                "nombre": "Martillo (Lanzamiento 30ft)",
                "tipo": "accion",
                "atk": "1d20+7",
                "dado": "1d10+1d6+4",
                "tipo_dano": "contundente/fuego",
                "desc": "Ataque a distancia 30ft. Retorno mental si <=30ft."
            },
            {
                "nombre": "TP al Martillo",
                "tipo": "adicional",
                "dado": "1d4",
                "tipo_dano": "fuerza",
                "desc": "Bonus: TP instantáneo al martillo. Enemigos a 10ft: DEX Save o caen + 1d4 fuerza."
            },
            {
                "nombre": "Velo de la Doncella",
                "tipo": "reaccion",
                "dado": "—",
                "desc": "1/día. Reacción: Inmunidad total a un ataque o hechizo. Activar tras ver el resultado."
            },
            {
                "nombre": "Lamento del Abismo",
                "tipo": "accion",
                "dado": "2d8+2d8",
                "tipo_dano": "necrótico/psíquico",
                "desc": "1/día. Cono 30ft. 2d8 necrótico + 2d8 psíquico (CON Save mitad)."
            },
            {
                "nombre": "Conjuro Rúnico (Inmovilizar)",
                "tipo": "adicional",
                "dado": "1d10",
                "tipo_dano": "fuerza",
                "desc": "Bonus. Toque, STR Save o Inmovilizado en piedra + 1d10 fuerza."
            }
        ]
    },

    "Ersenn": {
        "id": "Ersenn",
        "tipo": "aliado",
        "nombre": "Ersenn",
        "raza": "Celestial Exiliado",
        "clase": "Guardián del Umbral",
        "nivel": 11,
        "imagen": "",
        "stats": {
            "Fuerza": 14,
            "Destreza": 14,
            "Constitución": 16,
            "Inteligencia": 14,
            "Sabiduría": 20,
            "Carisma": 12
        },
        "resumen": {
            "HP": "165",
            "CA": "18",
            "Iniciativa": "+2",
            "Velocidad": "30ft",
            "Competencia": "+4"
        },
        "habilidades": ["Percepción", "Perspicacia", "Historia"],
        "rasgos": [
            {
                "nombre": "🔹 Naturaleza Exiliada",
                "desc": "No puede ser objetivo de resurrección, revivir o restauración divina. Cualquier intento falla automáticamente."
            },
            {
                "nombre": "🔹 Portador del Error",
                "desc": "Cada vez que una criatura muere a 30 ft de él, siente su muerte, incluso aunque no vea el cuerpo."
            },
            {
                "nombre": "🛡️ Resistencias",
                "desc": "Radiante, necrótico; daño contundente/cortante/perforante no mágico."
            },
            {
                "nombre": "🚫 Inmunidades",
                "desc": "Encantado, Asustado."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión verdadera 60 ft."
            },
            {
                "nombre": "🩸 Fragmentos de Alma (máx. 10)",
                "desc": "Absorbe 1 Fragmento por impacto con el Relicario (2 vs demonios/no-muertos). Capacidad máxima: 10. Puede gastarlos como acción adicional o reacción."
            },
            {
                "nombre": "💫 Cañón Espiritual (10 Fragmentos)",
                "desc": "1 uso especial. Línea 100ft, amplitud 30ft. TS Sabiduría (CD 18). 6d8 radiante + 2d12 fuerza."
            }
        ],
        "ranuras": [],
        "conjuros": [
            {
                "nombre": "Detectar el Mal y el Bien",
                "nivel": "Truco",
                "desc": "A voluntad. Sin componentes. Detecta celestiales, demonios, no-muertos y lugares sagrados/profanos a 30 ft."
            },
            {
                "nombre": "Luz",
                "nivel": "Truco",
                "desc": "A voluntad. Sin componentes. Objeto toca brilla con luz brillante en 20 ft y tenue 20 ft más."
            },
            {
                "nombre": "Bendición",
                "nivel": "Esp",
                "desc": "3/día. Hasta 3 criaturas suman 1d4 a sus ataques y TS durante 1 minuto (concentración)."
            },
            {
                "nombre": "Arma Espiritual",
                "nivel": "Esp",
                "desc": "3/día. Crea un arma espiritual flotante (bonus action para atacar: 1d8+5 fuerza). Dura 1 minuto."
            },
            {
                "nombre": "Destierro",
                "nivel": "Esp",
                "desc": "1/día. Solo demonios/no-muertos. CHA Save CD 18. Desterrado al plano de origen si falla. Concentración."
            }
        ],
        "combateExtra": [
            {
                "nombre": "Relicario del Umbral Caído",
                "tipo": "accion",
                "atk": "1d20+9",
                "dado": "2d12+5",
                "tipo_dano": "radiante",
                "desc": "Distancia 120/360 ft, ancho 10 ft. 2d12 radiante + SAB (+5). Absorbe 1 Fragmento de Alma por impacto (2 vs demonios/no-muertos)."
            },
            {
                "nombre": "Canalizar Culpa (Curación)",
                "tipo": "adicional",
                "dado": "2d10+5",
                "tipo_dano": "curación",
                "desc": "Coste: 2 Fragmentos. Se cura 2d10+SAB. Si <50% PV, gana resistencia a todo daño hasta su próximo turno."
            },
            {
                "nombre": "Disparo del Juicio Roto",
                "tipo": "adicional",
                "dado": "4d10+2d10",
                "tipo_dano": "radiante/necrótico",
                "desc": "Coste: 3 Fragmentos. Convierte 1 ataque: 4d10 radiante + 2d10 necrótico. El objetivo tiene desventaja en su siguiente TS."
            },
            {
                "nombre": "Liberación de Almas",
                "tipo": "accion",
                "dado": "4d8",
                "tipo_dano": "radiante",
                "desc": "Coste: 4 Fragmentos. Explosión 20 ft, TS SAB CD 18. 4d8 radiante. Demonios/no-muertos aturdidos hasta fin de su sig. turno si fallan."
            },
            {
                "nombre": "Recuerdo Persistente",
                "tipo": "reaccion",
                "dado": "—",
                "desc": "Coste: 2 Fragmentos. Enemigo impactado: TS SAB o Lentitud espiritual (vel. 0, sin reacciones, 1 turno)."
            }
        ]
    },

    "Tamariz": {
        "id": "Tamariz",
        "tipo": "aliado",
        "nombre": "Tamariz",
        "raza": "Humano",
        "clase": "Pícaro (Cartomago)",
        "nivel": 5,
        "imagen": "",
        "stats": {
            "Fuerza": 8,
            "Destreza": 18,
            "Constitución": 12,
            "Inteligencia": 16,
            "Sabiduría": 12,
            "Carisma": 14
        },
        "resumen": {
            "HP": "38",
            "CA": "17",
            "Iniciativa": "+4",
            "Velocidad": "30ft",
            "Competencia": "+3"
        },
        "habilidades": ["Persuasión", "Engaño", "Juego de Manos", "Sigilo"],
        "rasgos": [
            {
                "nombre": "🗡️ Ataque Furtivo (Sneak Attack) 3d6",
                "desc": "Añade +3d6 de daño cuando ataca con ventaja o un aliado está adyacente al objetivo. Aplicable con las cartas."
            },
            {
                "nombre": "👣 Acción Astuta (Cunning Action)",
                "desc": "Acción adicional para: Esconderse, Retirada (Disengage) o Correr (Dash)."
            },
            {
                "nombre": "🎭 Pericia (Expertise)",
                "desc": "Dobla la competencia en Persuasión y Engaño."
            },
            {
                "nombre": "🎩 Sombrero de Prestidigitador",
                "desc": "Ventaja en Persuasión. Permite hacer trucos de cartas no mágicos."
            },
            {
                "nombre": "💍 Anillo de Invisibilidad (3 usos/descanso largo)",
                "desc": "Invisibilidad como acción. Dura hasta 1 hora o hasta que ataque/lance conjuro."
            }
        ],
        "ranuras": [],
        "conjuros": [
            {
                "nombre": "Invisibilidad (Anillo)",
                "nivel": "Esp",
                "desc": "3/día. Acción. Invisible hasta 1 hora o hasta atacar/lanzar conjuro."
            }
        ],
        "combateExtra": [
            {
                "nombre": "Carta Básica",
                "tipo": "accion",
                "atk": "1d20+8",
                "dado": "1d8+4",
                "tipo_dano": "mágico",
                "desc": "Ataque con carta mágica. +8 al ataque. 1d8+4 daño mágico. Elige el tipo de carta al atacar."
            },
            {
                "nombre": "🟡 Carta Amarilla (Control)",
                "tipo": "accion",
                "atk": "1d20+8",
                "dado": "1d8+4",
                "tipo_dano": "mágico",
                "desc": "1d8+4 daño. El enemigo queda Inmovilizado hasta que Tamariz vuelva a atacar o reciba daño de otra fuente."
            },
            {
                "nombre": "🟤 Carta Marrón (Empuje)",
                "tipo": "accion",
                "atk": "1d20+8",
                "dado": "1d8+4",
                "tipo_dano": "mágico",
                "desc": "1d8+4 daño. El enemigo es empujado 20 ft en línea recta (TS FUE CD 13 para resistir)."
            },
            {
                "nombre": "🔴 Carta Roja (Explosión)",
                "tipo": "accion",
                "dado": "1d8",
                "tipo_dano": "mágico",
                "desc": "Radio 15 ft a punto visible a 60 ft. TS DES CD 13. Fallan: 1d8 daño mágico. Éxito: mitad."
            },
            {
                "nombre": "🔵 Carta Azul (Combo)",
                "tipo": "accion",
                "atk": "1d20+8",
                "dado": "1d8+4",
                "tipo_dano": "mágico",
                "desc": "1d8+4 daño. Permite un ataque inmediato adicional con otra Carta Azul (máx. 1 cadena)."
            },
            {
                "nombre": "✨ Estilo Tridente (4/día)",
                "tipo": "accion",
                "dado": "3×1d8+4",
                "tipo_dano": "mágico",
                "desc": "Lanza 3 cartas en línea recta (60 ft). Cada carta aplica su efecto si impacta. Puede combinar tipos. Adicionalmente tira 1d4: 1-2 → carta amarilla/marrón (daño x2); 3-4 → carta roja/azul (daño x3)."
            },
            {
                "nombre": "Acción Astuta",
                "tipo": "adicional",
                "dado": "—",
                "desc": "Bonus: Esconderse, Retirada o Correr."
            }
        ]
    },

    "Tumulario": {
        "id": "Tumulario",
        "tipo": "enemigo",
        "nombre": "Tumulario",
        "raza": "Mediano · Muerto viviente",
        "clase": "Guerrero no-muerto",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 15,
            "Destreza": 14,
            "Constitución": 16,
            "Inteligencia": 10,
            "Sabiduría": 13,
            "Carisma": 15
        },
        "resumen": {
            "HP": "82",
            "CA": "14",
            "Iniciativa": "+2",
            "Velocidad": "30ft",
            "Competencia": "+2"
        },
        "habilidades": ["Percepción", "Sigilo"],
        "rasgos": [
            {
                "nombre": "☀️ Sensibilidad a la luz solar",
                "desc": "Bajo la luz del sol tiene desventaja en pruebas de característica y tiradas de ataque."
            },
            {
                "nombre": "🛡️ Resistencias",
                "desc": "Necrótico."
            },
            {
                "nombre": "🚫 Inmunidades",
                "desc": "Veneno. Condiciones: Cansancio, Envenenado."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión en la oscuridad 18 m. Percepción pasiva 13."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "CR 3 (700 PX · BC +2)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Ataque múltiple",
                "tipo": "accion",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "Realiza dos ataques con espada necrótica o arco necrótico en cualquier combinación. Puede sustituir un ataque por Consumir vida."
            },
            {
                "nombre": "Espada necrótica",
                "tipo": "accion",
                "atk": "+4",
                "dado": "1d8+2",
                "tipo_dano": "cortante/necrótico",
                "desc": "CaC, alcance 1,5 m. 1d8+2 cortante + 1d8 necrótico."
            },
            {
                "nombre": "Arco necrótico",
                "tipo": "accion",
                "atk": "+4",
                "dado": "1d8+2",
                "tipo_dano": "perforante/necrótico",
                "desc": "A distancia, alcance 45/180 m. 1d8+2 perforante + 1d8 necrótico."
            },
            {
                "nombre": "Consumir vida",
                "tipo": "accion",
                "atk": "",
                "dado": "1d8+2",
                "tipo_dano": "necrótico",
                "desc": "TS Constitución CD 13, criatura a 1,5 m. Fallo: 1d8+2 necrótico y reduce PG máximos por ese daño. Humanoide que muera se convierte en zombi bajo su control (máx. 12)."
            }
        ]
    },

    "SabuesoInfernal": {
        "id": "SabuesoInfernal",
        "tipo": "enemigo",
        "nombre": "Sabueso Infernal",
        "raza": "Mediano · Infernal",
        "clase": "Bestia infernal",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 17,
            "Destreza": 12,
            "Constitución": 14,
            "Inteligencia": 6,
            "Sabiduría": 13,
            "Carisma": 6
        },
        "resumen": {
            "HP": "58",
            "CA": "15",
            "Iniciativa": "+1",
            "Velocidad": "50ft",
            "Competencia": "+2"
        },
        "habilidades": ["Percepción"],
        "rasgos": [
            {
                "nombre": "👥 Atacar en manada",
                "desc": "Tiene ventaja en tiradas de ataque si al menos un aliado está a 1,5 m o menos del objetivo y no está incapacitado."
            },
            {
                "nombre": "🚫 Inmunidades",
                "desc": "Fuego."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión en la oscuridad 18 m. Percepción pasiva 15."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "CR 3 (700 PX · BC +2)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Ataque múltiple",
                "tipo": "accion",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "Realiza dos ataques de mordisco."
            },
            {
                "nombre": "Mordisco",
                "tipo": "accion",
                "atk": "+5",
                "dado": "1d8+3",
                "tipo_dano": "perforante/fuego",
                "desc": "CaC, alcance 1,5 m. 1d8+3 perforante + 1d6 fuego."
            },
            {
                "nombre": "Aliento de fuego (rec. 5-6)",
                "tipo": "accion",
                "atk": "",
                "dado": "5d6",
                "tipo_dano": "fuego",
                "desc": "TS Destreza CD 12, todas las criaturas en cono de 4,5 m. Fallo: 5d6 fuego. Éxito: mitad del daño."
            }
        ]
    },

    "Otyugh": {
        "id": "Otyugh",
        "tipo": "enemigo",
        "nombre": "Otyugh",
        "raza": "Grande · Aberración",
        "clase": "Aberración",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 16,
            "Destreza": 11,
            "Constitución": 19,
            "Inteligencia": 6,
            "Sabiduría": 13,
            "Carisma": 6
        },
        "resumen": {
            "HP": "104",
            "CA": "14",
            "Iniciativa": "+0",
            "Velocidad": "30ft",
            "Competencia": "+3"
        },
        "habilidades": [],
        "rasgos": [
            {
                "nombre": "🔊 Telepatía",
                "desc": "Telepatía 36 m (unidireccional — no permite respuesta telepática al receptor)."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión en la oscuridad 36 m. Percepción pasiva 11."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "CR 5 (1800 PX · BC +3)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Ataque múltiple",
                "tipo": "accion",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "Realiza un ataque de mordisco y dos ataques de tentáculo."
            },
            {
                "nombre": "Mordisco",
                "tipo": "accion",
                "atk": "+6",
                "dado": "2d8+3",
                "tipo_dano": "perforante",
                "desc": "CaC, alcance 1,5 m. 2d8+3 perforante y el objetivo queda envenenado. Al terminar descanso largo: TS CON CD 15 o reduce PG máximos en 1d10. Éxito: elimina envenenamiento."
            },
            {
                "nombre": "Tentáculo",
                "tipo": "accion",
                "atk": "+6",
                "dado": "2d8+3",
                "tipo_dano": "perforante",
                "desc": "CaC, alcance 3 m. 2d8+3 perforante. Criatura Mediana o menor: estado agarrado (CD 13 para escapar), hasta dos criaturas a la vez."
            },
            {
                "nombre": "Golpe con tentáculo",
                "tipo": "accion",
                "atk": "",
                "dado": "3d8+3",
                "tipo_dano": "contundente",
                "desc": "TS Constitución CD 14, todas las criaturas agarradas. Fallo: 3d8+3 contundente + estado aturdido hasta su próximo turno. Éxito: mitad del daño."
            }
        ]
    },

    "AcechadorOsgo": {
        "id": "AcechadorOsgo",
        "tipo": "enemigo",
        "nombre": "Acechador Osgo",
        "raza": "Mediano · Feérico (trasgo)",
        "clase": "Guerrero feérico",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 17,
            "Destreza": 14,
            "Constitución": 14,
            "Inteligencia": 11,
            "Sabiduría": 12,
            "Carisma": 11
        },
        "resumen": {
            "HP": "65",
            "CA": "15",
            "Iniciativa": "+2",
            "Velocidad": "30ft",
            "Competencia": "+2"
        },
        "habilidades": ["Sigilo", "Supervivencia"],
        "rasgos": [
            {
                "nombre": "🏃 Rapto",
                "desc": "No necesita gastar movimiento adicional para desplazar a una criatura que tenga agarrada."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión en la oscuridad 18 m. Percepción pasiva 11."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "CR 3 (700 PX · BC +2)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Ataque múltiple",
                "tipo": "accion",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "Realiza dos ataques con jabalina o lucero del alba."
            },
            {
                "nombre": "Jabalina",
                "tipo": "accion",
                "atk": "+5",
                "dado": "3d6+3",
                "tipo_dano": "perforante",
                "desc": "CaC o distancia, alcance 3 m o 9/36 m. 3d6+3 perforante."
            },
            {
                "nombre": "Lucero del alba",
                "tipo": "accion",
                "atk": "+5",
                "dado": "2d8+3",
                "tipo_dano": "perforante",
                "desc": "CaC, alcance 3 m. 2d8+3 perforante. Con ventaja si el objetivo está agarrado."
            },
            {
                "nombre": "Agarre rápido",
                "tipo": "adicional",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "TS Destreza CD 13, criatura Mediana o menor a 3 m. Fallo: queda agarrada (CD 13 para escapar)."
            }
        ]
    },

    "Ogro": {
        "id": "Ogro",
        "tipo": "enemigo",
        "nombre": "Ogro",
        "raza": "Grande · Gigante",
        "clase": "Gigante",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 19,
            "Destreza": 8,
            "Constitución": 16,
            "Inteligencia": 5,
            "Sabiduría": 7,
            "Carisma": 7
        },
        "resumen": {
            "HP": "68",
            "CA": "11",
            "Iniciativa": "-1",
            "Velocidad": "40ft",
            "Competencia": "+2"
        },
        "habilidades": [],
        "rasgos": [
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión en la oscuridad 18 m. Percepción pasiva 8."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "CR 2 (450 PX · BC +2)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Garrote grande",
                "tipo": "accion",
                "atk": "+6",
                "dado": "2d8+4",
                "tipo_dano": "contundente",
                "desc": "CaC, alcance 1,5 m. 2d8+4 contundente."
            },
            {
                "nombre": "Jabalina",
                "tipo": "accion",
                "atk": "+6",
                "dado": "2d6+4",
                "tipo_dano": "perforante",
                "desc": "CaC o distancia, alcance 1,5 m o 9/36 m. 2d6+4 perforante."
            }
        ]
    },

    "Nycaloth": {
        "id": "Nycaloth",
        "tipo": "enemigo",
        "nombre": "Nycaloth",
        "raza": "Grande · Infernal (yugoloth)",
        "clase": "Yugoloth",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 20,
            "Destreza": 11,
            "Constitución": 19,
            "Inteligencia": 12,
            "Sabiduría": 10,
            "Carisma": 15
        },
        "resumen": {
            "HP": "152",
            "CA": "18",
            "Iniciativa": "+0",
            "Velocidad": "40ft / Vuelo 60ft",
            "Competencia": "+4"
        },
        "habilidades": ["Percepción", "Sigilo"],
        "rasgos": [
            {
                "nombre": "🔄 Recuperación infernal",
                "desc": "Si muere fuera de Gehenna, su cuerpo se disuelve en icor y revive con todos sus PG en algún lugar de Gehenna."
            },
            {
                "nombre": "✨ Resistencia mágica",
                "desc": "Ventaja en tiradas de salvación contra conjuros y efectos mágicos."
            },
            {
                "nombre": "🛡️ Resistencias",
                "desc": "Frío, fuego, relámpago."
            },
            {
                "nombre": "🚫 Inmunidades",
                "desc": "Ácido, veneno. Condición: Envenenado."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión ciega 18 m. Percepción pasiva 14."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "CR 9 (5000 PX · BC +4)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Ataque múltiple",
                "tipo": "accion",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "Realiza dos ataques con hacha voluble."
            },
            {
                "nombre": "Hacha voluble",
                "tipo": "accion",
                "atk": "+9",
                "dado": "2d12+5",
                "tipo_dano": "cortante/fuerza",
                "desc": "CaC o distancia, alcance 3 m o 9/27 m. 2d12+5 cortante + 3d6 fuerza. El hacha regresa mágicamente a su mano tras un ataque a distancia."
            },
            {
                "nombre": "Teletransporte sombrío",
                "tipo": "adicional",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "Se vuelve invisible 1 minuto y se teletransporta hasta 9 m a un espacio libre visible. La invisibilidad termina en cuanto causa daño."
            }
        ]
    },

    "YinBarkka": {
        "id": "YinBarkka",
        "tipo": "jugador",
        "nombre": "Yin Barkka",
        "raza": "—",
        "clase": "Pícaro",
        "nivel": 4,
        "fondo": "—",
        "imagen": "assets/imagenes/Yin_profile_pic.jpg",
        "imagenScale": 1,
        "stats": {
            "Fuerza": 8,
            "Destreza": 18,
            "Constitución": 16,
            "Inteligencia": 10,
            "Sabiduría": 14,
            "Carisma": 12
        },
        "resumen": {
            "HP": "43",
            "CA": "19",
            "Iniciativa": "+4",
            "Velocidad": "30ft",
            "Competencia": "+2"
        },
        "habilidades": [
            "Sigilo",
            "Acrobacias",
            "Percepción",
            "Engaño",
            "Juego de Manos",
            "Investigación"
        ],
        "rasgos": [
            {
                "nombre": "⚡ Ataque Furtivo (3d6)",
                "desc": "Si atacas con ventaja O hay un aliado a 5ft del objetivo: +3d6 de daño extra. Solo una vez por turno. Usa el chip 'Furtivo' junto al ataque."
            },
            {
                "nombre": "🎯 Forzar Críticos",
                "desc": "Si la criatura aún no ha actuado en esta iniciativa: ataca con ventaja.<br>Si está escondida/invisible/retenida/paralizada al atacar: crítico automático."
            },
            {
                "nombre": "⚔️ Katana del Dios del Trueno",
                "desc": "Daño: 1d10 cortante · Ignora resistencias e inmunidades.<br><strong>Desenvainar (1/largo, adicional):</strong> Durante 3 turnos +1d8 trueno por ataque. La magia de trueno queda en el cuerpo del enemigo.<br><strong>Envainar (1/largo, adicional):</strong> Todos los enemigos con trueno acumulado sufren 1d8 por cada impacto (máx. 6 veces a nv. 4).<br><strong>Danza de la Tormenta (adicional, +4 usos/descanso):</strong> +20ft velocidad + un ataque CaC adicional este turno."
            },
            {
                "nombre": "🔥 Daga de Fuego",
                "desc": "Daño: 1d12 fuego + 1d8 divino · Crítico automático → desmembra parte del cuerpo (lo elige el Master) · Puede cauterizar heridas."
            },
            {
                "nombre": "🌪️ Tornado (1/día, acción)",
                "desc": "Desde tu posición, crea un tornado en línea recta (20ft de largo · 5ft de ancho). TS Destreza o salen volando 1 turno + 2d8 daño (se aplica Furtivo si no han actuado aún).<br><strong>Acción adicional:</strong> Te teletransportas encima de todos los que estén volando y los atacas con ventaja (crítico si aplica, Furtivo no)."
            },
            {
                "nombre": "💨 Magia de Viento",
                "desc": "Al matar a una criatura, puedes realizar un ataque adicional inmediatamente."
            },
            {
                "nombre": "👢 Botas Rápidas",
                "desc": "<strong>Paso Brumoso (2/día, adicional):</strong> Te teletransportas hasta 30ft a cualquier lugar visible."
            },
            {
                "nombre": "🦺 Capa Espectral",
                "desc": "Siempre tienes ventaja en las pruebas de Sigilo · Si no hay mucha luz, te vuelves invisible."
            },
            {
                "nombre": "🌙 Armadura Espectral de Luna (CA 19 · 3 cargas)",
                "desc": "CA = 15 + DES (+4). Se recarga con la luz de la luna. Cada carga se usa como reacción:<br>• <strong>1d8 radiante</strong> cuando sabes que un ataque tuyo golpea.<br>• <strong>+2 CA</strong> cuando sabes que te van a golpear.<br>• <strong>Cegar</strong> a una criatura (TS CON CD 13 · cegada hasta su siguiente turno)."
            },
            {
                "nombre": "🛡️ Reacción: Mitad de daño",
                "desc": "Cuando recibes daño de un ataque, puedes usar tu reacción para sufrir solo la mitad.<br><strong>⚠️ Solo 1 reacción por ronda:</strong> si la usas, no puedes volver a reaccionar hasta el inicio de tu siguiente turno. Esto incluye las cargas de la armadura y el ataque de oportunidad."
            }
        ],
        "ranuras": [],
        "conjuros": [
            {
                "nombre": "Paso Brumoso",
                "nivel": "Obj",
                "desc": "2/día (Botas Rápidas). Teletransporte 30ft a lugar visible. Acción adicional."
            }
        ],
        "combateExtra": [
            {
                "nombre": "Katana del Trueno",
                "tipo": "accion",
                "atk": "+6",
                "dado": "1d10",
                "tipo_dano": "cortante/trueno",
                "desc": "CaC · 1d10 cortante (ignora resistencias e inmunidades) · +1d8 trueno si Desenvainar está activo · Impregna Magia de Trueno en el objetivo."
            },
            {
                "nombre": "Daga de Fuego",
                "tipo": "accion",
                "atk": "+6",
                "dado": "1d12+1d8",
                "tipo_dano": "fuego/divino",
                "desc": "CaC · 1d12 fuego + 1d8 divino · Crítico → desmembra · Puede cauterizar heridas."
            },
            {
                "nombre": "Furtivo (+3d6)",
                "tipo": "accion",
                "atk": "",
                "dado": "3d6",
                "tipo_dano": "furtivo",
                "desc": "Añade 3d6 al daño cuando ataca con ventaja O hay un aliado a 5ft del objetivo. Solo 1 vez por turno. Combina con Katana o Daga en el mismo ataque."
            },
            {
                "nombre": "Tornado (1/día)",
                "tipo": "accion",
                "atk": "",
                "dado": "2d8",
                "tipo_dano": "cortante/trueno",
                "desc": "Línea 20ft × 5ft. TS DES o salen volando 1 turno + 2d8. Furtivo si no han actuado aún."
            },
            {
                "nombre": "Danza de la Tormenta",
                "tipo": "adicional",
                "atk": "+6",
                "dado": "1d10",
                "tipo_dano": "cortante/trueno",
                "desc": "+20ft velocidad + ataque CaC adicional este turno · Hasta 4 usos por descanso corto o largo."
            },
            {
                "nombre": "Paso Brumoso (2/día)",
                "tipo": "adicional",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "Teletransporte 30ft a lugar visible (Botas Rápidas)."
            },
            {
                "nombre": "Desenvainar ⛈️ (1/largo)",
                "tipo": "adicional",
                "atk": "",
                "dado": "1d8",
                "tipo_dano": "trueno",
                "desc": "Activa Magia de Trueno: durante 3 turnos, cada ataque con Katana añade +1d8 trueno y deja trueno impregnado en el objetivo."
            },
            {
                "nombre": "Envainar ⚡ (1/largo)",
                "tipo": "adicional",
                "atk": "",
                "dado": "1d8×N",
                "tipo_dano": "trueno",
                "desc": "Todos los enemigos con trueno impregnado sufren 1d8 por cada impacto de trueno acumulado (acumulable, máx. 6 impactos a nv. 4)."
            },
            {
                "nombre": "Esconderse / Correr",
                "tipo": "adicional",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "Esconderse (prueba de Sigilo) · o Correr (duplica velocidad este turno)."
            },
            {
                "nombre": "⚠️ Mitad de daño",
                "tipo": "reaccion",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "Al recibir daño de un ataque: sufres solo la mitad. · ⚠️ Consume la reacción del asalto — no puedes usar otras reacciones (armadura, ataque de oportunidad) hasta tu siguiente turno."
            },
            {
                "nombre": "Armadura: +2 CA (carga)",
                "tipo": "reaccion",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "Al saber que te van a golpear: +2 CA contra ese ataque. Consume 1 carga (3 totales). · ⚠️ Consume la reacción del asalto."
            },
            {
                "nombre": "Armadura: Cegar (carga)",
                "tipo": "reaccion",
                "atk": "",
                "dado": "",
                "tipo_dano": "",
                "desc": "TS CON CD 13 o la criatura queda ciega hasta su siguiente turno. Consume 1 carga. · ⚠️ Consume la reacción del asalto."
            },
            {
                "nombre": "Armadura: 1d8 Radiante (carga)",
                "tipo": "reaccion",
                "atk": "",
                "dado": "1d8",
                "tipo_dano": "radiante",
                "desc": "Al saber que un ataque tuyo golpea: +1d8 radiante. Consume 1 carga. · ⚠️ Consume la reacción del asalto."
            }
        ]
    },

    "Behir": {
        "id": "Behir",
        "tipo": "enemigo",
        "nombre": "Behir",
        "raza": "Monstruosidad Enorme · Neutral malvada",
        "clase": "Bestia serpentina",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 23,
            "Destreza": 16,
            "Constitución": 18,
            "Inteligencia": 7,
            "Sabiduría": 14,
            "Carisma": 12
        },
        "resumen": {
            "HP": "168",
            "CA": "17",
            "Iniciativa": "+3",
            "Velocidad": "15 m / Trepar 15 m",
            "Competencia": "+4"
        },
        "habilidades": ["Percepción", "Sigilo"],
        "rasgos": [
            {
                "nombre": "⚡ Inmunidad",
                "desc": "Inmune al daño de relámpago."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión en la oscuridad 27 m. Percepción pasiva 16. Idiomas: dracónico."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "VD 11 (7200 PX · BC +4)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Mordisco",
                "tipo": "accion",
                "atk": "+10",
                "dado": "2d12+6+2d10",
                "tipo_dano": "perforante/relámpago",
                "desc": "CaC alcance 3 m. 2d12+6 perforante + 2d10 relámpago. Úsalo junto a Constreñir (Ataque múltiple)."
            },
            {
                "nombre": "Constreñir",
                "tipo": "accion",
                "dado": "5d8+6",
                "tipo_dano": "contundente",
                "desc": "TS FUE CD 18 a criatura Grande o menor a 1,5 m. Fallo: 5d8+6 contundente + queda Agarrado (CD 16 para escapar) y Apresado."
            },
            {
                "nombre": "Aliento de Relámpago (recarga 5–6)",
                "tipo": "accion",
                "dado": "12d10",
                "tipo_dano": "relámpago",
                "desc": "TS DES CD 16, criaturas en línea 27 m × 1,5 m. Fallo: 12d10 relámpago. Éxito: mitad del daño."
            },
            {
                "nombre": "Engullir",
                "tipo": "adicional",
                "dado": "6d6",
                "tipo_dano": "ácido",
                "desc": "TS DES CD 18, criatura Grande o menor que esté Agarrada. Fallo: la engulle (Apresada + Cegada + cobertura total). Inflige 6d6 ácido al inicio de cada turno del behir. Si recibe 30+ daño en un turno de la criatura engullida: TS CON CD 14 o la regurgita."
            }
        ]
    },

    "Ettin": {
        "id": "Ettin",
        "tipo": "enemigo",
        "nombre": "Ettin",
        "raza": "Gigante Grande · Caótico malvado",
        "clase": "Gigante de dos cabezas",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 21,
            "Destreza": 8,
            "Constitución": 17,
            "Inteligencia": 6,
            "Sabiduría": 10,
            "Carisma": 8
        },
        "resumen": {
            "HP": "85",
            "CA": "12",
            "Iniciativa": "-1",
            "Velocidad": "12 m",
            "Competencia": "+2"
        },
        "habilidades": ["Percepción"],
        "rasgos": [
            {
                "nombre": "🚫 Inmunidades (condiciones)",
                "desc": "Asustado, aturdido, cegado, ensordecido, hechizado, inconsciente."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión en la oscuridad 18 m. Percepción pasiva 14. Idiomas: gigante."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "VD 4 (1100 PX · BC +2)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Hacha de Guerra",
                "tipo": "accion",
                "atk": "+7",
                "dado": "2d8+5",
                "tipo_dano": "cortante",
                "desc": "CaC alcance 1,5 m. 2d8+5 cortante. Si el objetivo es Grande o menor, queda Derribado. Úsalo junto a Lucero del alba (Ataque múltiple)."
            },
            {
                "nombre": "Lucero del Alba",
                "tipo": "accion",
                "atk": "+7",
                "dado": "2d8+5",
                "tipo_dano": "perforante",
                "desc": "CaC alcance 1,5 m. 2d8+5 perforante. El objetivo tiene desventaja en su siguiente tirada de ataque antes del final de su siguiente turno."
            }
        ]
    },

    "Hezrou": {
        "id": "Hezrou",
        "tipo": "enemigo",
        "nombre": "Hezrou",
        "raza": "Infernal Grande (demonio) · Caótico malvado",
        "clase": "Demonio del Abismo",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 19,
            "Destreza": 17,
            "Constitución": 20,
            "Inteligencia": 5,
            "Sabiduría": 12,
            "Carisma": 13
        },
        "resumen": {
            "HP": "157",
            "CA": "18",
            "Iniciativa": "+6",
            "Velocidad": "9 m",
            "Competencia": "+3"
        },
        "habilidades": [],
        "rasgos": [
            {
                "nombre": "🛡️ Resistencias",
                "desc": "Frío, fuego, relámpago."
            },
            {
                "nombre": "🚫 Inmunidades",
                "desc": "Veneno (daño). Condición: Envenenado."
            },
            {
                "nombre": "🤢 Hedor",
                "desc": "TS CON CD 16 a criaturas que empiecen su turno en 3 m del hezrou. Fallo: quedan Envenenadas hasta el inicio de su siguiente turno."
            },
            {
                "nombre": "💀 Recuperación Demoníaca",
                "desc": "Si muere fuera del Abismo, su cuerpo se disuelve y revive con todos sus PV en el Abismo."
            },
            {
                "nombre": "✨ Resistencia Mágica",
                "desc": "Ventaja en tiradas de salvación contra conjuros y efectos mágicos."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión en la oscuridad 36 m. Percepción pasiva 11. Telepatía 36 m. Idiomas: abisal."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "VD 8 (3900 PX · BC +3)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Desgarro",
                "tipo": "accion",
                "atk": "+7",
                "dado": "1d4+4+2d8",
                "tipo_dano": "cortante/veneno",
                "desc": "CaC alcance 1,5 m. 1d4+4 cortante + 2d8 veneno. Ataque múltiple: realiza tres desgarros."
            },
            {
                "nombre": "Salto",
                "tipo": "adicional",
                "dado": "",
                "tipo_dano": "",
                "desc": "Gasta 3 m de movimiento para saltar hasta 9 m."
            }
        ]
    },

    "HombreRata": {
        "id": "HombreRata",
        "tipo": "enemigo",
        "nombre": "Hombre Rata",
        "raza": "Monstruosidad Mediana/Pequeña (licántropo) · Legal malvada",
        "clase": "Licántropo",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 10,
            "Destreza": 16,
            "Constitución": 12,
            "Inteligencia": 11,
            "Sabiduría": 10,
            "Carisma": 8
        },
        "resumen": {
            "HP": "60",
            "CA": "13",
            "Iniciativa": "+3",
            "Velocidad": "9 m / Trepar 9 m",
            "Competencia": "+2"
        },
        "habilidades": ["Percepción", "Sigilo"],
        "rasgos": [
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión en la oscuridad 18 m. Percepción pasiva 14. Idiomas: común (no puede hablar en forma de rata)."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "VD 2 (450 PX · BC +2)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Arañazo",
                "tipo": "accion",
                "atk": "+5",
                "dado": "1d6+3",
                "tipo_dano": "cortante",
                "desc": "CaC alcance 1,5 m. Ataque múltiple: dos arañazos/ballestas en cualquier combinación, puede sustituir uno por Mordisco."
            },
            {
                "nombre": "Mordisco (forma rata/híbrida)",
                "tipo": "accion",
                "atk": "+5",
                "dado": "2d4+3",
                "tipo_dano": "perforante",
                "desc": "CaC alcance 1,5 m. 2d4+3 perforante. Si el objetivo es humanoide: TS CON CD 11. Fallo: queda Maldito. Si sus PV llegan a 0 maldito, se convierte en Hombre Rata controlado por el DM con 10 PV."
            },
            {
                "nombre": "Ballesta de Mano (forma humanoide/híbrida)",
                "tipo": "accion",
                "atk": "+5",
                "dado": "1d6+3",
                "tipo_dano": "perforante",
                "desc": "Ataque a distancia, alcance 9/36 m. 1d6+3 perforante."
            },
            {
                "nombre": "Cambio de Forma",
                "tipo": "adicional",
                "dado": "",
                "tipo_dano": "",
                "desc": "Adopta forma híbrida rata-humanoide Mediana, rata Pequeña, o recupera su forma humanoide. Sus estadísticas son iguales en todas las formas."
            }
        ]
    },

    "DragonRojoJoven": {
        "id": "DragonRojoJoven",
        "tipo": "enemigo",
        "nombre": "Dragón Rojo Joven",
        "raza": "Dragón Enorme · Caótico malvado",
        "clase": "Dragón cromático",
        "nivel": "—",
        "imagen": "",
        "stats": {
            "Fuerza": 19,
            "Destreza": 10,
            "Constitución": 17,
            "Inteligencia": 12,
            "Sabiduría": 11,
            "Carisma": 15
        },
        "resumen": {
            "HP": "75",
            "CA": "17",
            "Iniciativa": "+2",
            "Velocidad": "9 m / Trepar 9 m / Volar 18 m",
            "Competencia": "+2"
        },
        "habilidades": ["Percepción", "Sigilo"],
        "rasgos": [
            {
                "nombre": "🔥 Inmunidad",
                "desc": "Inmune al daño de fuego."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión ciega 3 m, visión en la oscuridad 18 m. Percepción pasiva 14. Idiomas: dracónico."
            },
            {
                "nombre": "⭐ Desafío",
                "desc": "VD 4 (1100 PX · BC +2)"
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Desgarro",
                "tipo": "accion",
                "atk": "+6",
                "dado": "1d10+4+1d6",
                "tipo_dano": "cortante/fuego",
                "desc": "CaC alcance 1,5 m. 1d10+4 cortante + 1d6 fuego. Ataque múltiple: realiza dos desgarros."
            },
            {
                "nombre": "Aliento de Fuego (recarga 5–6)",
                "tipo": "accion",
                "dado": "7d6",
                "tipo_dano": "fuego",
                "desc": "TS DES CD 13, criaturas en cono de 4,5 m. Fallo: 7d6 fuego. Éxito: mitad del daño."
            }
        ]
    },

    "Jayce": {
        "id": "Jayce",
        "tipo": "enemigo",
        "nombre": "Jayce, el Emisario Carmesí",
        "raza": "No-muerto (Vampiro)",
        "clase": "Vampiro Ancestral",
        "nivel": 10,
        "imagen": "",
        "stats": {
            "Fuerza": 16,
            "Destreza": 14,
            "Constitución": 22,
            "Inteligencia": 14,
            "Sabiduría": 12,
            "Carisma": 18
        },
        "resumen": {
            "HP": "220",
            "CA": "16",
            "Iniciativa": "+2",
            "Velocidad": "30ft / Vuelo 30ft",
            "Competencia": "+3"
        },
        "habilidades": ["Sigilo", "Persuasión", "Engaño", "Percepción"],
        "rasgos": [
            {
                "nombre": "🔄 Regeneración",
                "desc": "Recupera 5 PV al inicio de su turno si no recibió daño de fuego o radiante el turno anterior."
            },
            {
                "nombre": "🌫️ Forma de Niebla",
                "desc": "Si llega a 0 PV sin recibir daño de fuego/radiante, se disuelve en niebla con 1 PV. Incorpóreo, mueve 30 ft/turno, no puede atacar. Si escapa, podría regresar."
            },
            {
                "nombre": "🛡️ Resistencias",
                "desc": "Necrótico, psíquico, daño de armas no mágicas, encantado."
            },
            {
                "nombre": "🚫 Inmunidades",
                "desc": "Veneno. No puede ser dormido."
            },
            {
                "nombre": "⚠️ Debilidades",
                "desc": "Fuego, divino y plata infligen daño doble / anulan regeneración."
            },
            {
                "nombre": "👁️ Sentidos",
                "desc": "Visión en la oscuridad 120 ft, visión verdadera, percepción pasiva 11."
            }
        ],
        "ranuras": [],
        "conjuros": [],
        "combateExtra": [
            {
                "nombre": "Colmillos de Sangre",
                "tipo": "accion",
                "atk": "1d20+6",
                "dado": "1d6+3+1d4",
                "tipo_dano": "perforante/necrótico",
                "desc": "CaC, alcance 5 ft. 1d6+3 perforante + 1d4 necrótico. Recupera PV iguales al daño necrótico infligido."
            },
            {
                "nombre": "Charco de Sangre",
                "tipo": "adicional",
                "dado": "3d6",
                "tipo_dano": "contundente",
                "desc": "Se disuelve en sangre 1 turno (5 ft radio). Resistencia a todo excepto fuego/radiante. Sin ataques de oportunidad. Al volver a forma material: TS CON a criaturas cercanas, fallan → 3d6 daño y se cura la mitad."
            },
            {
                "nombre": "Transfusión Dolorosa",
                "tipo": "accion",
                "dado": "1d10–3d10",
                "tipo_dano": "necrótico",
                "desc": "Sacrifica hasta 15 PV. Por cada 5 PV sacrificados inflige 1d10 necrótico en cono 30 ft. TS DES CD 12, mitad en éxito."
            },
            {
                "nombre": "Garra del Cautiverio (3/día)",
                "tipo": "accion",
                "dado": "2d6",
                "tipo_dano": "necrótico",
                "desc": "Línea 60 ft, 15 ft ancho. 2d6 necrótico. TS FUE CD 14 o queda atado+aturdido 1 turno y arrastrado 30 ft hacia Jayce."
            },
            {
                "nombre": "Ojo del Vampiro (5/día)",
                "tipo": "accion",
                "dado": "1d10",
                "tipo_dano": "psíquico",
                "desc": "Radio 15 ft a punto a 60 ft. TS CON: fallan → 1d10 psíquico. Jayce se cura el daño infligido."
            },
            {
                "nombre": "Apoteosis Carmesí (1/día)",
                "tipo": "accion",
                "dado": "3d10+1d8",
                "tipo_dano": "necrótico",
                "desc": "Estado vampírico 3 turnos. Al activar: cura 3d10. Cada turno: criaturas hostiles en 15 ft sufren 1d8+nº criaturas necrótico. Recupera mitad del daño total. Levita, inmune a parálisis/miedo/encantamiento."
            }
        ]
    }
};
