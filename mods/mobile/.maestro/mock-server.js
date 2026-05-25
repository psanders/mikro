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
  { id: "c1", name: "Juan Pérez", nickname: null, phone: "+18095550001", isActive: true },
  { id: "c2", name: "María García", nickname: "La Doña", phone: "+18095550002", isActive: true },
  { id: "c3", name: "Carlos Reyes", nickname: null, phone: "+18095550003", isActive: true }
];

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
  return JSON.stringify({ result: { data } });
}

function err(message, code) {
  return JSON.stringify({ error: { message, code } });
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
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return {};
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
    const raw = await readBody(req);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
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

  // Catch-all for unknown tRPC routes — return empty success
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
