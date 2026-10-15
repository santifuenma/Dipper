-- Enlace personal para que el atajo de Apple Pay envíe los pagos
ALTER TABLE users ADD COLUMN ingest_token TEXT;
CREATE UNIQUE INDEX idx_users_ingest ON users(ingest_token);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  icon TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_categories_user ON categories(user_id, position);

CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last4 TEXT NOT NULL,
  wallet_name TEXT,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_cards_user ON cards(user_id);

-- amount_cents: positivo = gasto, negativo = devolución
-- merchant_key: comercio normalizado ("MERCADONA"), sirve para recordar su categoría
CREATE TABLE charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  merchant_raw TEXT NOT NULL,
  merchant_key TEXT NOT NULL,
  merchant_name TEXT NOT NULL,
  card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  wallet_card TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'done')),
  source TEXT NOT NULL CHECK (source IN ('applepay', 'manual')),
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_charges_user_status ON charges(user_id, status, occurred_at);
CREATE INDEX idx_charges_user_date ON charges(user_id, occurred_at);

CREATE TABLE merchant_rules (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_key TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, merchant_key)
);

-- Categorías por defecto para las cuentas que ya existen (las nuevas las crea el registro)
INSERT INTO categories (user_id, icon, name, color, budget_cents, position, created_at)
SELECT id, 'sup', 'Súper', '#CDF56B', 38000, 0, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM users;
INSERT INTO categories (user_id, icon, name, color, budget_cents, position, created_at)
SELECT id, 'com', 'Comida fuera', '#FFC2A1', 24000, 1, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM users;
INSERT INTO categories (user_id, icon, name, color, budget_cents, position, created_at)
SELECT id, 'tra', 'Transporte', '#A9D8FF', 18000, 2, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM users;
INSERT INTO categories (user_id, icon, name, color, budget_cents, position, created_at)
SELECT id, 'oci', 'Ocio', '#FFA8D2', 15000, 3, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM users;
INSERT INTO categories (user_id, icon, name, color, budget_cents, position, created_at)
SELECT id, 'rop', 'Ropa', '#CDB6FF', 25000, 4, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM users;
INSERT INTO categories (user_id, icon, name, color, budget_cents, position, created_at)
SELECT id, 'sus', 'Suscripciones', '#98EBC6', 20000, 5, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM users;
