/* eslint-disable */
/**
 * Lightweight mock tRPC server for Maestro e2e tests.
 * Zero dependencies — runs on plain Node.js http module.
 *
 * Usage: node mock-server.js
 * Listens on port 4400 by default (override with PORT env var).
 */
const http = require("http");

const PORT = process.env.PORT || 4400;

const FAKE_TOKEN = "eyJtb2NrIjp0cnVlLCJzdWIiOiJ0ZXN0LWNvbGxlY3RvciJ9";

const COLLECTOR = { id: "test-collector", name: "Pedro Test" };

const CUSTOMERS = [
  {
    id: "c1",
    name: "Juan Pérez",
    nickname: null,
    phone: "+18095550001",
    isActive: true,
    idNumber: "001-1234567-8",
    homeAddress: "Calle 1, Los Prados",
    collectionPoint: "Colmado Los Prados",
    createdAt: "2025-01-15T10:00:00.000Z"
  },
  {
    id: "c2",
    name: "María García",
    nickname: "La Doña",
    phone: "+18095550002",
    isActive: true,
    idNumber: "002-7654321-0",
    homeAddress: "Av. Principal, Naco",
    collectionPoint: null,
    createdAt: "2024-06-01T10:00:00.000Z"
  },
  {
    id: "c3",
    name: "Carlos Reyes",
    nickname: null,
    phone: "+18095550003",
    isActive: true,
    idNumber: null,
    homeAddress: "Sector Villa Mella",
    collectionPoint: null,
    createdAt: "2025-03-20T10:00:00.000Z"
  }
];

const LOANS = [
  {
    id: 1001,
    customerId: "c1",
    customer: { id: "c1", name: "Juan Pérez", nickname: null, phone: "+18095550001" },
    principal: 30000,
    paymentAmount: 2500,
    termLength: 12,
    installmentNumber: 3,
    frequency: "DAILY",
    status: "ACTIVE",
    startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 1002,
    customerId: "c2",
    customer: { id: "c2", name: "María García", nickname: "La Doña", phone: "+18095550002" },
    principal: 20000,
    paymentAmount: 2000,
    termLength: 10,
    installmentNumber: 5,
    frequency: "DAILY",
    status: "ACTIVE",
    startDate: new Date(Date.now() - 60 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
  },
  {
    id: 1003,
    customerId: "c3",
    customer: { id: "c3", name: "Carlos Reyes", nickname: null, phone: "+18095550003" },
    principal: 45000,
    paymentAmount: 3000,
    termLength: 15,
    installmentNumber: 1,
    frequency: "DAILY",
    status: "ACTIVE",
    startDate: new Date().toISOString(),
    createdAt: new Date().toISOString()
  },
  {
    id: 1004,
    customerId: "c1",
    customer: { id: "c1", name: "Juan Pérez", nickname: null, phone: "+18095550001" },
    principal: 18000,
    paymentAmount: 1500,
    termLength: 12,
    installmentNumber: 8,
    frequency: "DAILY",
    status: "ACTIVE",
    startDate: new Date(Date.now() - 90 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
  },
  {
    id: 1005,
    customerId: "c2",
    customer: { id: "c2", name: "María García", nickname: "La Doña", phone: "+18095550002" },
    principal: 30000,
    paymentAmount: 3000,
    termLength: 10,
    installmentNumber: 2,
    frequency: "DAILY",
    status: "ACTIVE",
    startDate: new Date(Date.now() - 10 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  }
];

const now = new Date();
const PAYMENTS = [
  {
    id: "pay-1",
    loanId: 1001,
    amount: "2500",
    kind: "INSTALLMENT",
    method: "CASH",
    status: "CONFIRMED",
    collectedById: "test-collector",
    paidAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 30).toISOString(),
    createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 30).toISOString()
  },
  {
    id: "pay-2",
    loanId: 1002,
    amount: "2000",
    kind: "INSTALLMENT",
    method: "CASH",
    status: "CONFIRMED",
    collectedById: "test-collector",
    paidAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 15).toISOString(),
    createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 15).toISOString()
  }
];

let paymentCounter = PAYMENTS.length;

const DASHBOARD = {
  collector: COLLECTOR,
  dailyTarget: 12000,
  amountCollected: 4500,
  visitsDone: 2,
  visitsPending: 3,
  visits: [
    {
      loanId: 1001,
      customerId: "c1",
      customerName: "Juan Pérez",
      loanNickname: null,
      address: "Calle 1, Los Prados",
      paymentAmount: 2500,
      installmentNumber: 3,
      termLength: 12,
      isOverdue: false,
      daysOverdue: 0,
      paidToday: true,
      amountPaidToday: 2500,
      nextDueDate: new Date().toISOString()
    },
    {
      loanId: 1002,
      customerId: "c2",
      customerName: "María García",
      loanNickname: "La Doña",
      address: "Av. Principal, Naco",
      paymentAmount: 2000,
      installmentNumber: 5,
      termLength: 10,
      isOverdue: true,
      daysOverdue: 3,
      paidToday: true,
      amountPaidToday: 2000,
      nextDueDate: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      loanId: 1003,
      customerId: "c3",
      customerName: "Carlos Reyes",
      loanNickname: null,
      address: "Sector Villa Mella",
      paymentAmount: 3000,
      installmentNumber: 1,
      termLength: 15,
      isOverdue: false,
      daysOverdue: 0,
      paidToday: false,
      amountPaidToday: 0,
      nextDueDate: new Date().toISOString()
    },
    {
      loanId: 1004,
      customerId: "c1",
      customerName: "Juan Pérez",
      loanNickname: "Colmado Juan",
      address: "Calle 1, Los Prados",
      paymentAmount: 1500,
      installmentNumber: 8,
      termLength: 12,
      isOverdue: true,
      daysOverdue: 7,
      paidToday: false,
      amountPaidToday: 0,
      nextDueDate: new Date(Date.now() - 7 * 86400000).toISOString()
    },
    {
      loanId: 1005,
      customerId: "c2",
      customerName: "María García",
      loanNickname: null,
      address: "Av. Principal, Naco",
      paymentAmount: 3000,
      installmentNumber: 2,
      termLength: 10,
      isOverdue: false,
      daysOverdue: 0,
      paidToday: false,
      amountPaidToday: 0,
      nextDueDate: new Date(Date.now() + 86400000).toISOString()
    }
  ]
};

function ok(data) {
  return JSON.stringify([{ result: { data } }]);
}

function err(message, code) {
  return JSON.stringify([{ error: { message, code } }]);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

function getInput(url) {
  const match = url.match(/[?&]input=([^&]*)/);
  if (!match) return {};
  try {
    const raw = JSON.parse(decodeURIComponent(match[1]));
    if (raw["0"] && raw["0"].json) return raw["0"].json;
    return raw;
  } catch {
    return {};
  }
}

function getPostInput(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed["0"] && parsed["0"].json) return parsed["0"].json;
    return parsed;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const path = req.url.split("?")[0];

  // POST /trpc/login
  if (path === "/trpc/login" && req.method === "POST") {
    const data = getPostInput(await readBody(req));
    if (!data) {
      res.writeHead(400);
      return res.end(err("Invalid JSON", -32600));
    }
    if (data.phone && data.password) {
      res.writeHead(200);
      return res.end(ok({ token: FAKE_TOKEN, name: COLLECTOR.name }));
    }
    res.writeHead(401);
    return res.end(err("Invalid credentials", -32001));
  }

  // POST /trpc/createPayment
  if (path === "/trpc/createPayment" && req.method === "POST") {
    const data = getPostInput(await readBody(req));
    if (!data) {
      res.writeHead(400);
      return res.end(err("Invalid JSON", -32600));
    }
    paymentCounter++;
    const payment = {
      id: `pay-${paymentCounter}`,
      loanId: data.loanId,
      amount: String(data.amount),
      kind: data.kind || "INSTALLMENT",
      method: data.method || "CASH",
      status: "CONFIRMED",
      collectedById: data.collectedById || "test-collector",
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    PAYMENTS.push(payment);
    res.writeHead(200);
    return res.end(ok(payment));
  }

  // POST /trpc/createLoanNote
  if (path === "/trpc/createLoanNote" && req.method === "POST") {
    const data = getPostInput(await readBody(req));
    res.writeHead(200);
    return res.end(
      ok({
        id: "note-1",
        loanId: data?.loanId,
        text: data?.text,
        createdAt: new Date().toISOString()
      })
    );
  }

  // GET /trpc/getCollectorDashboard
  if (path === "/trpc/getCollectorDashboard") {
    res.writeHead(200);
    return res.end(ok(DASHBOARD));
  }

  // GET /trpc/listCustomers
  if (path === "/trpc/listCustomers") {
    const input = getInput(req.url);
    let results = CUSTOMERS;
    if (input.search) {
      const q = input.search.toLowerCase();
      results = CUSTOMERS.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.nickname && c.nickname.toLowerCase().includes(q)) ||
          c.phone.includes(q)
      );
    }
    res.writeHead(200);
    return res.end(ok(results));
  }

  // GET /trpc/getCustomer
  if (path === "/trpc/getCustomer") {
    const input = getInput(req.url);
    const customer = CUSTOMERS.find((c) => c.id === input.id);
    if (customer) {
      res.writeHead(200);
      return res.end(ok(customer));
    }
    res.writeHead(404);
    return res.end(err("Customer not found", -32004));
  }

  // GET /trpc/getLoanByLoanId
  if (path === "/trpc/getLoanByLoanId") {
    const input = getInput(req.url);
    const loan = LOANS.find((l) => l.id === input.loanId);
    if (loan) {
      res.writeHead(200);
      return res.end(ok(loan));
    }
    res.writeHead(404);
    return res.end(err("Loan not found", -32004));
  }

  // GET /trpc/previewLateFee
  if (path === "/trpc/previewLateFee") {
    const input = getInput(req.url);
    const visit = DASHBOARD.visits.find((v) => v.loanId === input.loanId);
    const loan = LOANS.find((l) => l.id === input.loanId);
    const cuota = loan ? Number(loan.paymentAmount) : 0;
    const accruedMora = visit && visit.isOverdue ? Math.round(cuota * 0.1) : 0;
    res.writeHead(200);
    return res.end(ok({ cuota, accruedMora }));
  }

  // GET /trpc/listPayments
  if (path === "/trpc/listPayments") {
    res.writeHead(200);
    return res.end(ok(PAYMENTS));
  }

  // GET /trpc/listPaymentsByCustomer
  if (path === "/trpc/listPaymentsByCustomer") {
    const input = getInput(req.url);
    const customerLoans = LOANS.filter((l) => l.customerId === input.customerId).map((l) => l.id);
    const results = PAYMENTS.filter((p) => customerLoans.includes(p.loanId));
    res.writeHead(200);
    return res.end(ok(results));
  }

  // GET /trpc/listPaymentsByLoanId
  if (path === "/trpc/listPaymentsByLoanId") {
    const input = getInput(req.url);
    const results = PAYMENTS.filter((p) => p.loanId === input.loanId);
    res.writeHead(200);
    return res.end(ok(results));
  }

  // Catch-all for unknown tRPC routes
  if (path.startsWith("/trpc/")) {
    res.writeHead(200);
    return res.end(ok(null));
  }

  res.writeHead(404);
  res.end(err("Not found", -32004));
});

server.listen(PORT, () => {
  console.log(`Mock tRPC server running on http://localhost:${PORT}`);
});
