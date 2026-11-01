-- Dispositivos que han activado los avisos (notificaciones push de la PWA).
-- Cada fila es una suscripción del navegador: el servidor la avisa cuando llega un pago por revisar.
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT,
  auth TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);
