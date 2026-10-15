-- Nombre propio de cada comercio: los pagos que lleguen de Apple Pay con ese comercio
-- entran ya con este nombre (merchant_raw sigue guardando el original de Apple Pay).
CREATE TABLE merchant_names (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_key TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, merchant_key)
);
