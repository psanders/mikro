-- Marital status becomes an enum (SQLite keeps the TEXT column; Prisma
-- validates the values). One-time mapping of the old form labels, and the
-- variants José typed, to codes. Values that are already codes are left as
-- they are (a site posting codes may have reached the old server first).

-- The column: anything unrecognized becomes NULL so no read can fail on it.
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

-- rawData: the column is re-derived from it on every reviewer edit, so a
-- label left there would wipe the column on the next edit. Mapped labels
-- become codes; codes, blanks and unrecognized answers are left as sent.
UPDATE "loan_applications" SET "raw_data" = json_set("raw_data", '$.maritalStatus', CASE
  WHEN lower(trim(json_extract("raw_data", '$.maritalStatus'))) IN ('soltero(a)', 'soltero/a', 'soltero', 'soltera') THEN 'SOLTERO'
  WHEN lower(trim(json_extract("raw_data", '$.maritalStatus'))) IN ('casado(a)', 'casado/a', 'casado', 'casada') THEN 'CASADO'
  WHEN lower(trim(json_extract("raw_data", '$.maritalStatus'))) IN ('unión libre', 'union libre') THEN 'UNION_LIBRE'
  WHEN lower(trim(json_extract("raw_data", '$.maritalStatus'))) IN ('divorciado(a)', 'divorciado/a', 'divorciado', 'divorciada') THEN 'DIVORCIADO'
  WHEN lower(trim(json_extract("raw_data", '$.maritalStatus'))) IN ('viudo(a)', 'viudo/a', 'viudo', 'viuda') THEN 'VIUDO'
END)
WHERE json_valid("raw_data")
  AND lower(trim(json_extract("raw_data", '$.maritalStatus'))) IN (
    'soltero(a)', 'soltero/a', 'soltero', 'soltera',
    'casado(a)', 'casado/a', 'casado', 'casada',
    'unión libre', 'union libre',
    'divorciado(a)', 'divorciado/a', 'divorciado', 'divorciada',
    'viudo(a)', 'viudo/a', 'viudo', 'viuda'
  );
