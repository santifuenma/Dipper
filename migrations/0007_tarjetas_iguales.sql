-- Pagos cuyo nombre de Wallet coincide con varias tarjetas tuyas (dos tarjetas que se llaman
-- igual): no se colocan solos, en "Por revisar" se pregunta con qué tarjeta se pagó.
ALTER TABLE charges ADD COLUMN card_check INTEGER NOT NULL DEFAULT 0;

-- Los pendientes que ya estaban en ese caso también preguntan.
UPDATE charges SET card_check = 1
WHERE status = 'pending' AND wallet_card IS NOT NULL
  AND (SELECT COUNT(*) FROM cards c
       WHERE c.user_id = charges.user_id AND LOWER(c.wallet_name) = LOWER(charges.wallet_card)) > 1;
