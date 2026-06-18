/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Paperclip, Plus } from "lucide-react";
import { trpc } from "../lib/trpc";
import { PageHeader } from "../components/ui/PageHeader";
import { Tab } from "../components/ui/Tab";
import { Select } from "../components/ui/Select";
import { StatusText } from "../components/ui/StatusText";
import { formatDop, formatDate } from "../lib/applications";
import {
  TYPE_TABS,
  typeMeta,
  statusMeta,
  accountKindMeta,
  defaultDateRange,
  type TransactionType
} from "../lib/accounting";

const PAGE_SIZE = 20;

// Pencil "Operations / 09 Contabilidad (Transacciones)" (y3c8Wl)
export function ContabilidadPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [activeType, setActiveType] = useState<TransactionType | "all">("all");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [includeReversed, setIncludeReversed] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  const accounts = trpc.accounting.listAccounts.useQuery({});
  const categories = trpc.accounting.listCategories.useQuery({});

  const txQuery = trpc.accounting.listTransactions.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    type: activeType === "all" ? undefined : activeType,
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    includeReversed: includeReversed || undefined,
    limit
  });

  const rows = txQuery.data ?? [];

  function resetLimit() {
    setLimit(PAGE_SIZE);
  }

  function handleTypeChange(v: TransactionType | "all") {
    setActiveType(v);
    resetLimit();
  }

  function handleAccountChange(id: string) {
    setAccountId(id);
    resetLimit();
  }

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    resetLimit();
  }

  function handleIncludeReversedChange(v: boolean) {
    setIncludeReversed(v);
    resetLimit();
  }

  function handleDateChange(field: "startDate" | "endDate", val: string) {
    setDateRange((prev) => ({ ...prev, [field]: new Date(val).toISOString() }));
    resetLimit();
  }

  const subtitle =
    txQuery.data != null ? `Transacciones · ${rows.length} mostradas` : "Transacciones del período";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Contabilidad"
        subtitle={subtitle}
        action={
          <button
            type="button"
            onClick={() => setShowRegisterForm(true)}
            className="flex items-center gap-2 rounded-[10px] bg-brand-blue-primary px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            <Plus size={15} />
            Registrar transacción
          </button>
        }
      />

      <div className="flex flex-col gap-4 p-7">
        {/* Accounts balance strip */}
        <AccountsStrip accounts={accounts.data} />

        {/* Toolbar: type tabs + filters */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1">
            {TYPE_TABS.map((t) => (
              <Tab
                key={t.value}
                active={activeType === t.value}
                onClick={() => handleTypeChange(t.value)}
              >
                {t.label}
              </Tab>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-ds-muted">Desde</label>
              <input
                type="date"
                value={dateRange.startDate.slice(0, 10)}
                onChange={(e) => handleDateChange("startDate", e.target.value)}
                className="rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
              />
              <label className="text-xs text-ds-muted">Hasta</label>
              <input
                type="date"
                value={dateRange.endDate.slice(0, 10)}
                onChange={(e) => handleDateChange("endDate", e.target.value)}
                className="rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
              />
            </div>

            <Select value={accountId} onChange={(e) => handleAccountChange(e.target.value)}>
              <option value="">Todas las cuentas</option>
              {accounts.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>

            <Select value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <label className="flex items-center gap-2 text-[13px] text-brand-ink cursor-pointer">
              <input
                type="checkbox"
                checked={includeReversed}
                onChange={(e) => handleIncludeReversedChange(e.target.checked)}
                className="h-4 w-4 rounded border-ds-border"
              />
              Incluir reversadas
            </label>
          </div>
        </div>

        {/* Transactions table */}
        <div className="overflow-hidden rounded-[14px] border border-ds-border bg-ds-surface">
          <div className="flex items-center gap-[14px] border-b border-ds-border bg-ds-bg px-5 py-[11px] text-xs font-medium uppercase tracking-[0.3px] text-ds-muted">
            <span className="w-[130px]">Fecha</span>
            <span className="w-[90px]">Tipo</span>
            <span className="w-[160px]">Cuenta</span>
            <span className="w-[130px]">Categoría</span>
            <span className="flex-1">Descripción</span>
            <span className="w-[120px] text-right">Monto</span>
            <span className="w-[100px]">Estado</span>
            <span className="w-8" />
          </div>

          {txQuery.isPending && <div className="px-5 py-6 text-sm text-ds-muted">Cargando…</div>}

          {txQuery.isError && (
            <div className="px-5 py-6 text-sm text-ds-red" role="alert">
              No se pudieron cargar las transacciones. {txQuery.error.message}
            </div>
          )}

          {txQuery.data && rows.length === 0 && (
            <div className="px-5 py-6 text-sm text-ds-muted">
              No hay transacciones para este período y filtro.
            </div>
          )}

          {rows.map((tx, i) => {
            const last = i === rows.length - 1;
            const tipo = typeMeta(tx.type);
            const estado = statusMeta(tx.status);
            const cuenta =
              tx.type === "TRANSFER" && tx.toAccount
                ? `${tx.account.name} → ${tx.toAccount.name}`
                : tx.account.name;
            const descripcion = tx.description || tx.vendor || "";
            return (
              <button
                key={tx.id}
                type="button"
                onClick={() => navigate(`/contabilidad/${tx.id}`, { viewTransition: true })}
                className={`flex w-full items-center gap-[14px] px-5 py-3 text-left hover:bg-ds-subtle ${
                  last ? "" : "border-b border-ds-border"
                }`}
              >
                <span className="w-[130px] text-[13px] text-ds-muted">
                  {formatDate(tx.occurredAt)}
                </span>
                <span className="w-[90px]">
                  <StatusText tone={tipo.tone} className="text-[12px]">
                    {tipo.label}
                  </StatusText>
                </span>
                <span className="w-[160px] truncate text-[13px] text-brand-ink">{cuenta}</span>
                <span className="w-[130px] truncate text-[13px] text-ds-muted">
                  {tx.category?.name ?? ""}
                </span>
                <span className="flex-1 truncate text-[13px] text-ds-muted">{descripcion}</span>
                <span className="w-[120px] text-right text-[13px] font-medium text-brand-ink">
                  {formatDop(tx.amount)}
                </span>
                <span className="w-[100px]">
                  <StatusText tone={estado.tone} className="text-[12px]">
                    {estado.label}
                  </StatusText>
                </span>
                <span className="flex w-8 items-center justify-end gap-1">
                  {tx.attachmentCount > 0 && <Paperclip size={13} className="text-ds-muted" />}
                  <ChevronRight size={16} className="text-ds-muted" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Load more */}
        {rows.length >= limit && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE_SIZE)}
              disabled={txQuery.isFetching}
              className="rounded-[10px] border border-ds-border bg-ds-surface px-5 py-2 text-[13px] font-medium text-brand-ink hover:bg-ds-subtle disabled:opacity-50"
            >
              {txQuery.isFetching ? "Cargando…" : "Cargar más"}
            </button>
          </div>
        )}
      </div>

      {showRegisterForm && (
        <RegisterTransactionModal
          accounts={accounts.data ?? []}
          categories={categories.data ?? []}
          onClose={() => setShowRegisterForm(false)}
          onSuccess={() => {
            setShowRegisterForm(false);
            void utils.accounting.listTransactions.invalidate();
            void utils.accounting.listAccounts.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accounts balance strip
// ---------------------------------------------------------------------------

function AccountsStrip({
  accounts
}: {
  accounts: Array<{ id: string; name: string; kind: string; currentBalance: number }> | undefined;
}) {
  if (!accounts) return null;
  if (accounts.length === 0) {
    return (
      <div className="rounded-[12px] border border-ds-border bg-ds-surface px-5 py-3 text-[13px] text-ds-muted">
        No hay cuentas registradas.
      </div>
    );
  }
  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
  return (
    <div className="flex gap-3 flex-wrap">
      <div className="flex flex-col gap-2 rounded-[14px] bg-brand-blue-deep px-[18px] py-[18px] min-w-[160px]">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-white/90">Balance total</span>
          <span className="text-[11px] font-medium text-white/60">todas las cuentas</span>
        </div>
        <span className="text-[22px] font-bold leading-tight tracking-[-0.5px] text-white">
          {formatDop(totalBalance)}
        </span>
      </div>
      {accounts.map((a) => (
        <div
          key={a.id}
          className="flex flex-col gap-1 rounded-[12px] border border-ds-border bg-ds-surface px-5 py-3 min-w-[160px]"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.3px] text-ds-muted">
            {accountKindMeta(a.kind).label}
          </span>
          <span className="text-[13px] font-medium text-brand-ink">{a.name}</span>
          <span className="text-base font-bold text-brand-ink">{formatDop(a.currentBalance)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register transaction modal
// ---------------------------------------------------------------------------

type AccountRow = { id: string; name: string; kind: string };
type CategoryRow = { id: string; name: string; kind: string };

function RegisterTransactionModal({
  accounts,
  categories,
  onClose,
  onSuccess
}: {
  accounts: AccountRow[];
  categories: CategoryRow[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createTx = trpc.accounting.createTransaction.useMutation({ onSuccess });

  const [type, setType] = useState<TransactionType>("DEPOSIT");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [reference, setReference] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const showToAccount = type === "TRANSFER";
  const showCategory = type === "EXPENSE" || type === "INCOME";
  const filteredCategories = showCategory ? categories.filter((c) => c.kind === type) : [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("El monto debe ser un número positivo.");
      return;
    }
    if (!accountId) {
      setFormError("Selecciona una cuenta.");
      return;
    }
    if (showToAccount && !toAccountId) {
      setFormError("Para Transferencia se requiere una cuenta destino.");
      return;
    }
    if (showToAccount && toAccountId === accountId) {
      setFormError("La cuenta destino debe ser diferente a la cuenta origen.");
      return;
    }

    createTx.mutate(
      {
        type,
        accountId,
        toAccountId: showToAccount ? toAccountId : undefined,
        categoryId: showCategory && categoryId ? categoryId : undefined,
        amount: amountNum,
        occurredAt: new Date(occurredAt).toISOString(),
        description: description || undefined,
        vendor: vendor || undefined,
        reference: reference || undefined
      },
      {
        onError(err) {
          setFormError(err.message);
        }
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-[16px] border border-ds-border bg-ds-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-ds-border px-6 py-4">
          <span className="text-[15px] font-semibold text-brand-ink">Registrar transacción</span>
          <button type="button" onClick={onClose} className="text-ds-muted hover:text-brand-ink">
            ✕
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 overflow-y-auto max-h-[80vh] p-6"
        >
          <FormField label="Tipo">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
              className="w-full"
              required
            >
              {TYPE_TABS.filter((t) => t.value !== "all").map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Cuenta">
            <Select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full"
              required
            >
              <option value="">— Seleccionar —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FormField>

          {showToAccount && (
            <FormField label="Cuenta destino">
              <Select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full"
                required
              >
                <option value="">— Seleccionar —</option>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            </FormField>
          )}

          {showCategory && (
            <FormField label="Categoría">
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full"
              >
                <option value="">— Sin categoría —</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField label="Monto (RD$)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
              required
              placeholder="0.00"
            />
          </FormField>

          <FormField label="Fecha">
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
              required
            />
          </FormField>

          <FormField label="Descripción">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
              maxLength={500}
              placeholder="Opcional"
            />
          </FormField>

          <FormField label="Proveedor">
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
              maxLength={200}
              placeholder="Opcional"
            />
          </FormField>

          <FormField label="Referencia">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
              maxLength={200}
              placeholder="Opcional"
            />
          </FormField>

          {formError && (
            <p className="text-sm text-ds-red" role="alert">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-ds-border px-4 py-2 text-[13px] font-medium text-brand-ink hover:bg-ds-subtle"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createTx.isPending}
              className="rounded-[10px] bg-brand-blue-primary px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {createTx.isPending ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium uppercase tracking-[0.3px] text-ds-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
