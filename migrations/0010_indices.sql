-- Índices para que el recuento de pagos por categoría y por tarjeta (borrar, listados) no recorra toda la tabla.
CREATE INDEX idx_charges_category ON charges(category_id);
CREATE INDEX idx_charges_card ON charges(card_id);
