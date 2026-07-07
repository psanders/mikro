/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Health extends BaseCommand<typeof Health> {
  static override readonly description =
    "run the collections spec checks over one loan (with optional LLM explanation) or the whole portfolio";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --all",
    "<%= config.bin %> <%= command.id %> 10034",
    "<%= config.bin %> <%= command.id %> 10034 --explain"
  ];

  static override readonly args = {
    loanId: Args.string({
      description: "Loan ID (numeric). Omit to check the whole portfolio.",
      required: false
    })
  };

  static override readonly flags = {
    explain: Flags.boolean({
      char: "e",
      description: "Add an LLM narration of how the numbers were reached (single loan only)",
      default: false
    }),
    all: Flags.boolean({
      char: "a",
      description: "Portfolio scan: include loans in every status, not just ACTIVE",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Health);
    const client = this.createClient();

    try {
      if (args.loanId) {
        await this.checkOne(client, Number(args.loanId), flags.explain);
      } else {
        await this.checkPortfolio(client, flags.all);
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }

  private async checkOne(
    client: ReturnType<Health["createClient"]>,
    loanId: number,
    explain: boolean
  ): Promise<void> {
    const { snapshot, report, narration } = await client.getLoanHealth.query({ loanId, explain });
    const d = snapshot.derived;

    this.log("");
    this.log(`Préstamo #${loanId} — ${snapshot.customer.nickname ?? snapshot.customer.name}`);
    this.log(
      `  Cuotas cubiertas: ${d.cuotasCovered}/${d.termLength}   Pendientes: ${d.pendingPayments}`
    );
    this.log(
      `  Abonado: RD$${d.totalInstallmentPaid}   Saldo: RD$${d.remainingBalance}   Mora: RD$${d.moraAccrued}`
    );
    this.log(`  Ciclos atrasados: ${d.missedCycles}   Días de atraso: ${d.daysLate}`);
    this.log("");
    this.log(report.pass ? "✔ Todas las verificaciones OK" : "✗ Verificaciones con fallas:");
    for (const r of report.results) {
      const mark = r.pass ? "✔" : "✗";
      const detail = r.pass ? "" : `  (esperado ${r.expected}; real ${r.actual})`;
      this.log(`  ${mark} ${r.id}${detail}`);
    }

    if (narration) {
      this.log("");
      this.log("Análisis:");
      this.log(narration);
    }
    this.log("");
  }

  private async checkPortfolio(
    client: ReturnType<Health["createClient"]>,
    includeAllStatuses: boolean
  ): Promise<void> {
    const report = await client.runPortfolioHealthCheck.query({ includeAllStatuses });

    this.log("");
    this.log(
      `Cartera: ${report.loansPassing}/${report.loansChecked} sanos, ${report.loansFailing} con problemas.`
    );

    if (report.failuresByCheck.length > 0) {
      this.log("");
      this.log("Fallas por verificación:");
      for (const f of report.failuresByCheck) {
        this.log(`  ${f.count.toString().padStart(4)} × ${f.id} (${f.severity})`);
      }
    }

    if (report.offenders.length > 0) {
      this.log("");
      this.log("Préstamos con fallas (peores primero):");
      for (const o of report.offenders) {
        const crit = o.criticalFailures.length
          ? ` [crítico: ${o.criticalFailures.join(", ")}]`
          : "";
        this.log(`  #${o.loanId} ${o.customerName} — ${o.failCount} falla(s)${crit}`);
      }
    }
    this.log("");
  }
}
