import type { ParamMap, SOAInput, SOAResult, ScheduleRow } from "./types";

/**
 * Local SOA engine. Pure + transparent. All rates/terms come from
 * computation_params (never hardcoded), so changing them needs no deploy.
 * Penalty follows Civil Code Art. 1253: a payment is applied to penalty and
 * interest before principal.
 *
 * TODO(client-confirm): confirm exact step-up / balloon formulas and penalty
 * basis. This is a faithful, editable default until the n8n Computation Agent
 * schema is provided.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10);
}
function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm] = fromIso.split("-").map(Number);
  const [ty, tm] = toIso.split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}
function amortize(principal: number, rate: number, term: number): number {
  if (term <= 0) return principal;
  if (rate === 0) return principal / term;
  return (principal * rate) / (1 - Math.pow(1 + rate, -term));
}

function simulate(
  paymentFn: (period: number) => number,
  principal: number,
  rate: number,
  term: number,
) {
  let balance = principal;
  const rows: { n: number; interest: number; scheduled_payment: number; principal: number; balance_after: number }[] = [];
  for (let i = 1; i <= term; i++) {
    const interest = balance * rate;
    const pay = paymentFn(i - 1);
    let principalPaid = pay - interest;
    if (principalPaid > balance) principalPaid = balance;
    balance -= principalPaid;
    rows.push({ n: i, interest, scheduled_payment: pay, principal: principalPaid, balance_after: balance });
  }
  return { rows, ending: balance };
}

/** Binary-search a base payment so the schedule ends at targetEnding. */
function solveBase(
  make: (base: number) => (period: number) => number,
  principal: number,
  rate: number,
  term: number,
  targetEnding: number,
): number {
  let lo = 0;
  let hi = principal * 2 + 1;
  for (let it = 0; it < 80; it++) {
    const mid = (lo + hi) / 2;
    const { ending } = simulate(make(mid), principal, rate, term);
    if (ending > targetEnding) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function computeLocal(input: SOAInput, params: ParamMap): SOAResult {
  const annual = input.annual_interest_rate ?? params.annual_interest_rate ?? 0.1;
  const rate = annual / 12;
  const term = Math.max(1, input.term_months || params.default_term_months || 60);
  const principal = Math.max(0, (input.tcp ?? 0) - (input.downpayment ?? 0));
  const penaltyRate = params.penalty_monthly_rate ?? 0.02;

  let paymentFn: (period: number) => number;
  let extraFinal = 0;

  if (input.scheme === "step_up") {
    const inc = params.stepup_increment_rate ?? 0.05;
    const period = Math.max(1, params.stepup_period_months ?? 12);
    const make = (base: number) => (i: number) =>
      base * Math.pow(1 + inc, Math.floor(i / period));
    paymentFn = make(solveBase(make, principal, rate, term, 0));
  } else if (input.scheme === "balloon") {
    const balloonPrincipal = principal * (params.balloon_percent ?? 0.2);
    const make = (base: number) => () => base;
    paymentFn = make(solveBase(make, principal, rate, term, balloonPrincipal));
    extraFinal = balloonPrincipal;
  } else {
    const p = amortize(principal, rate, term);
    paymentFn = () => p;
  }

  const { rows } = simulate(paymentFn, principal, rate, term);
  if (extraFinal > 0 && rows.length) {
    const last = rows[rows.length - 1];
    const applied = Math.min(extraFinal, last.balance_after);
    last.scheduled_payment += extraFinal;
    last.principal += applied;
    last.balance_after = Math.max(0, last.balance_after - extraFinal);
  }

  const schedule: ScheduleRow[] = rows.map((r) => ({
    n: r.n,
    due_date: addMonths(input.start_date, r.n),
    scheduled_payment: round2(r.scheduled_payment),
    interest: round2(r.interest),
    principal: round2(r.principal),
    balance_after: round2(r.balance_after),
    status: "upcoming",
    paid_applied: 0,
    penalty: 0,
  }));

  // Apply actual payments oldest-installment-first, penalty+interest before principal.
  const totalPaid = (input.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  let pool = totalPaid;
  let contractBalance = 0;
  let amountDueNow = 0;
  let totalPenalty = 0;
  let nextDue: string | null = null;

  for (const row of schedule) {
    const overdue = row.due_date < input.asOf;
    const monthsLate = overdue ? monthsBetween(row.due_date, input.asOf) : 0;
    const penalty = overdue ? round2(row.scheduled_payment * penaltyRate * monthsLate) : 0;
    totalPenalty += penalty;

    const payPenalty = Math.min(pool, penalty);
    pool -= payPenalty;
    const payInterest = Math.min(pool, row.interest);
    pool -= payInterest;
    const payPrincipal = Math.min(pool, row.principal);
    pool -= payPrincipal;

    const unpaidPrincipal = row.principal - payPrincipal;
    const unpaidTotal = penalty - payPenalty + (row.interest - payInterest) + unpaidPrincipal;
    contractBalance += unpaidPrincipal;
    if (row.due_date <= input.asOf) amountDueNow += unpaidTotal;

    row.penalty = penalty;
    row.paid_applied = round2(payPenalty + payInterest + payPrincipal);
    const fullyPaid = unpaidTotal <= 0.01;
    row.status = fullyPaid
      ? "paid"
      : row.paid_applied > 0
        ? "partial"
        : overdue
          ? "due"
          : "upcoming";
    if (!fullyPaid && !nextDue) nextDue = row.due_date;
  }

  return {
    source: "local",
    params_version: params.params_version ?? 1,
    scheme: input.scheme,
    principal: round2(principal),
    term_months: term,
    monthly_rate: rate,
    schedule,
    totals: {
      scheduled_total: round2(schedule.reduce((s, r) => s + r.scheduled_payment, 0)),
      total_paid: round2(totalPaid),
      total_penalty: round2(totalPenalty),
      principal_paid: round2(principal - contractBalance),
      contract_balance: round2(contractBalance),
      amount_due_now: round2(amountDueNow),
    },
    next_due_date: nextDue,
    generated_at: new Date().toISOString(),
  };
}
