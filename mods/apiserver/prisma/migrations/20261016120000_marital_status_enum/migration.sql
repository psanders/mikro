-- Marital status becomes an enum (SQLite keeps the TEXT column; Prisma
-- validates the values). Map the form labels and the variants José typed to
-- codes; anything unrecognized becomes NULL so no read can fail on it.
UPDATE "loan_applications" SET "marital_status" = CASE
  WHEN "marital_status" IN ('SOLTERO', 'CASADO', 'UNION_LIBRE', 'DIVORCIADO', 'VIUDO') THEN "marital_status"
  WHEN lower(trim("marital_status")) IN ('soltero(a)', 'soltero/a', 'soltero', 'soltera') THEN 'SOLTERO'
  WHEN lower(trim("marital_status")) IN ('casado(a)', 'casado/a', 'casado', 'casada') THEN 'CASADO'
  WHEN lower(trim("marital_status")) IN ('unión libre', 'union libre') THEN 'UNION_LIBRE'
  WHEN lower(trim("marital_status")) IN ('divorciado(a)', 'divorciado/a', 'divorciado', 'divorciada') THEN 'DIVORCIADO'
  WHEN lower(trim("marital_status")) IN ('viudo(a)', 'viudo/a', 'viudo', 'viuda') THEN 'VIUDO'
  ELSE NULL
END
WHERE "marital_status" IS NOT NULL;
