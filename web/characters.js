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
            "Fuerza": 10,
            "Destreza": 16,
            "Constitución": 16,
            "Inteligencia": 10,
            "Sabiduría": 12,
            "Carisma": 20
        },
        "resumen": {
            "HP": "38",
            "CA": "17",
            "Iniciativa": "+2",
            "Velocidad": "30ft",
            "Competencia": "+3"
        },
        "habilidades": [
            "Arcanos",
            "Engaño",
            "Intimidación",
            "Persuasión"
        ],
        "rasgos": [
            {
                "nombre": "🗡️ Pacto del Filo (Hexblade)",
                "desc": "Arma invocada a voluntad. Usa CAR para ataque/daño. Crítico 19-20 contra maldito."
            },
            {
                "nombre": "🩸 Recuperación Oscura",
                "desc": "Al reducir a 0 HP hostil: Ganas HP Temp = Mod CAR + Nivel."
            },
            {
                "nombre": "🔮 Invocaciones Sobrenaturales",
                "desc": "<strong>Estallido Agonizante:</strong> +CAR al daño de Eldritch Blast.<br><strong>Estallido Repulsor:</strong> Empuja 10ft.<br><strong>Influencia Seductora:</strong> Comp. Engaño y Persuasión."
            },
            {
                "nombre": "👹 Aura Demoníaca (Transformación)",
                "desc": "Duración: 5 turnos. Efectos:<br>+2 CA.<br>Velocidad 50ft.<br>+1d8 extra por ataque.<br>Inmune a Hechizar y Ralentizar."
            },
            {
                "nombre": "⚔️ Espada Demoníaca (Objeto)",
                "desc": "Daño: 1d10 cort + 1d4 necrótico.<br><strong>Aura Necrótica (1/Largo - 1 min):</strong> Radio 20ft (móvil).<br>1. CD Miedo al activar.<br>2. Terreno Difícil.<br>3. Daño al salir (2d8 necrótico).<br>4. Daño dentro (1d12 necrótico/turno).<br>5. TODO daño necrótico dentro se duplica."
            },
            {
                "nombre": "🧣 Bufanda de Araña (Objeto)",
                "desc": "Mano de Mago a voluntad (60ft)."
            },
            {
                "nombre": "🪞 Espejo Vampírico (Objeto)",
                "desc": "2 Horrocruxes. Si caes a 0 HP -> Espectro con 1 HP (salvo fuego/divino).<br><strong>TP Espejos:</strong> A voluntad a tus espejos o cualquier superficie reflectante."
            },
            {
                "nombre": "📜 Don de Lenguas",
                "desc": "Lees todo. Hablas/entiendes cualquier idioma 1/día."
            }
        ],
        "ranuras": [
            { "nombre": "Pacto (Nv2)", "total": 2 }
        ],
        "conjuros": [
            {
                "nombre": "Estallido Arcano (Melee)",
                "nivel": "Truco",
                "desc": "1d10 fuerza + CAR (+Empuje)."
            },
            {
                "nombre": "Manos Ardientes",
                "nivel": 3,
                "desc": "Cono 15ft. 3d6 fuego."
            },
            {
                "nombre": "Orden Imperiosa",
                "nivel": 3,
                "desc": "1 palabra. SAB Save."
            },
            {
                "nombre": "Ceguera/Sordera",
                "nivel": 3,
                "desc": "CON Save. Ciego o Sordo."
            },
            {
                "nombre": "Rayo Abrasador",
                "nivel": 3,
                "desc": "3 Rayos de 2d6 fuego."
            },
            {
                "nombre": "Escudo de Fe",
                "nivel": "Esp",
                "desc": "+2 CA (1/día gratis)."
            },
            {
                "nombre": "Hex / Mal de Ojo",
                "nivel": 3,
                "desc": "1d6 daño extra necrótico al golpear + Desventaja stat."
            },
            {
                "nombre": "Paso Brumoso",
                "nivel": 3,
                "desc": "Teletransporte 30ft (Bonus)."
            },
            {
                "nombre": "Escudo",
                "nivel": 1,
                "desc": "+5 CA Reacción (Hexblade)."
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
            "Fuerza": 12,
            "Destreza": 14,
            "Constitución": 16,
            "Inteligencia": 18,
            "Sabiduría": 10,
            "Carisma": 8
        },
        "resumen": {
            "HP": "43",
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
                "nombre": "🌑 Bastón del Vacío",
                "desc": "+1 Ataque. <strong>Reacción:</strong> Represión Infernal (2d10 fuego/necrótico) al recibir daño. Recupera slots (N1/3 turnos)."
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
                "nombre": "Susurros del Olvido",
                "nivel": "Esp",
                "desc": "3d6 psíquico + Huir (SAB)."
            },
            {
                "nombre": "Invisibilidad",
                "nivel": 2,
                "desc": "1 hora o hasta atacar."
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
            "Destreza": 10,
            "Constitución": 16,
            "Inteligencia": 8,
            "Sabiduría": 12,
            "Carisma": 14
        },
        "resumen": {
            "HP": "49",
            "CA": "20",
            "Iniciativa": "+0",
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
                "nombre": "🛡️ Escudo de Atrapamiento",
                "desc": "Reacción cuando fallan un ataque contra ti: STR Save. Si falla, queda atrapado contra el escudo hasta su siguiente turno."
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
                "desc": "Reserva: 25 PG. 5 puntos curan veneno/enfermedad."
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
            { "nombre": "Nv1", "total": 3 },
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
                "nombre": "Detectar Magia / Bien y Mal",
                "nivel": 1,
                "desc": "Utilidad."
            }
        ]
    }
};