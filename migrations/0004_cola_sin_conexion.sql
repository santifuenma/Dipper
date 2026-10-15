-- Huella de cada pago recibido desde Atajos: si el atajo reenvía un pago que ya llegó
-- (cola guardada en el iPhone cuando no había conexión), se ignora en vez de duplicarse.
ALTER TABLE charges ADD COLUMN ingest_key TEXT;
CREATE UNIQUE INDEX idx_charges_ingest_key ON charges(user_id, ingest_key);
