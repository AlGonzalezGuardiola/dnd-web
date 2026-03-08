window.characterData = {
    "Vel": {
        "id": "Vel",
        "nombre": "Vel'Rhazal Vardros",
        "raza": "Humano Demonio",
        "clase": "Brujo (Hexblade)",
        "nivel": 4,
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
            { "nombre": "Pacto (Nv2)", "total": 2 }
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
        ]
    },
    "Zero": {
        "id": "Zero",
        "nombre": "Zero",
        "raza": "Warforged",
        "clase": "Mago Invocador del Vacío",
        "nivel": 4,
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
            "Competencia": "+2"
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
            { "nombre": "Nv2", "total": 3 }
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
        ]
    },
    "Asthor": {
        "id": "Asthor",
        "nombre": "Asthor, Martillo Argento",
        "raza": "Enano",
        "clase": "Paladín",
        "nivel": 4,
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
            { "nombre": "Nv1", "total": 3 }
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
        ]
    }
};
