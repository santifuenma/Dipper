-- Concepto de cada pago: una nota propia ("regalo de Marta", "cena de grupo"), distinta del comercio.
ALTER TABLE charges ADD COLUMN concept TEXT;
