-- Cómo se entró en cada sesión: con Face ID se puede cambiar la contraseña sin saber la actual.
ALTER TABLE sessions ADD COLUMN method TEXT NOT NULL DEFAULT 'password';
