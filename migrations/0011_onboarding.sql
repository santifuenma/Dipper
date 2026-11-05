-- Bienvenida de las cuentas nuevas: en qué paso van (0-7; 8 = terminada), si ya vieron la guía del Inicio y si
-- han quitado el recordatorio de lo que les falta. Las cuentas que ya existen quedan como "terminada".
ALTER TABLE users ADD COLUMN onboarding_step INTEGER NOT NULL DEFAULT 8;
ALTER TABLE users ADD COLUMN tour_seen INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN reminder_off INTEGER NOT NULL DEFAULT 0;
