-- ============================================================
-- schema.sql — Base de datos Polla FIFA 2026
-- PostgreSQL
-- ============================================================

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    rol         VARCHAR(20)  NOT NULL DEFAULT 'usuario',  -- 'usuario' o 'admin'
    creado_en   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Tabla de partidos
CREATE TABLE IF NOT EXISTS partidos (
    id              SERIAL PRIMARY KEY,
    equipo_local    VARCHAR(80)  NOT NULL,
    equipo_visita   VARCHAR(80)  NOT NULL,
    bandera_local   VARCHAR(10)  NOT NULL DEFAULT '',   -- emoji de bandera
    bandera_visita  VARCHAR(10)  NOT NULL DEFAULT '',
    fecha           TIMESTAMP    NOT NULL,
    fase            VARCHAR(50)  NOT NULL DEFAULT 'Grupos',  -- Grupos, Octavos, Cuartos, etc.
    goles_local     INT,
    goles_visita    INT,
    finalizado      BOOLEAN      NOT NULL DEFAULT FALSE
);

-- Tabla de apuestas (una por usuario por partido)
CREATE TABLE IF NOT EXISTS apuestas (
    id                    SERIAL PRIMARY KEY,
    id_usuario            INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    id_partido            INT NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    goles_local_apostado  INT NOT NULL,
    goles_visita_apostado INT NOT NULL,
    puntos                INT NOT NULL DEFAULT 0,
    UNIQUE (id_usuario, id_partido)
);

-- Tabla de apuesta al campeón (una por usuario)
CREATE TABLE IF NOT EXISTS apuesta_campeon (
    id              SERIAL PRIMARY KEY,
    id_usuario      INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE UNIQUE,
    campeon         VARCHAR(80) NOT NULL,
    puntos_campeon  INT NOT NULL DEFAULT 0
);

-- ============================================================
-- Datos de ejemplo: partidos de la fase de grupos
-- ============================================================
INSERT INTO partidos (equipo_local, equipo_visita, bandera_local, bandera_visita, fecha, fase) VALUES
('México',    'Polonia',     '🇲🇽', '🇵🇱', '2026-06-11 18:00:00', 'Grupos'),
('Argentina', 'Arabia Saudita', '🇦🇷', '🇸🇦', '2026-06-12 12:00:00', 'Grupos'),
('Francia',   'Australia',   '🇫🇷', '🇦🇺', '2026-06-12 15:00:00', 'Grupos'),
('Brasil',    'Serbia',      '🇧🇷', '🇷🇸', '2026-06-12 18:00:00', 'Grupos'),
('España',    'Costa Rica',  '🇪🇸', '🇨🇷', '2026-06-13 12:00:00', 'Grupos'),
('Alemania',  'Japón',       '🇩🇪', '🇯🇵', '2026-06-13 15:00:00', 'Grupos'),
('Estados Unidos', 'Gales',  '🇺🇸', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '2026-06-13 18:00:00', 'Grupos'),
('Portugal',  'Ghana',       '🇵🇹', '🇬🇭', '2026-06-14 12:00:00', 'Grupos');
