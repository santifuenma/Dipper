-- Presupuesto total del mes (del diseño: 1.500 €). Se edita en la pantalla Presupuesto.
ALTER TABLE users ADD COLUMN monthly_budget_cents INTEGER NOT NULL DEFAULT 150000;
