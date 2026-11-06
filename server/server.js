// server/server.js - High performance REST API and Web Server using built-in node:http and node:sqlite
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const { db } = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

// Helper to read JSON request body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5e6) { // 5MB limit
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Helper to send JSON response
function sendJson(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Helper to send Error response
function sendError(res, message, statusCode = 400) {
  sendJson(res, { error: message, success: false }, statusCode);
}

// Generate TallyPrime XML Voucher for an export invoice
function generateTallyXml(invoice) {
  const vchDate = (invoice.invoice_date || '').replace(/-/g, '');
  const partyName = invoice.buyer_name || 'Cash Party';
  const totalAmt = Number(invoice.total_invoice_amount || 0).toFixed(2);
  const taxableVal = Number(invoice.taxable_value || 0).toFixed(2);
  const isInterstate = Number(invoice.is_interstate) === 1;
  const igstAmt = isInterstate ? Number(invoice.igst_amount || 0).toFixed(2) : '0.00';
  const cgstAmt = !isInterstate ? Number(invoice.cgst_amount || 0).toFixed(2) : '0.00';
  const sgstAmt = !isInterstate ? Number(invoice.sgst_amount || 0).toFixed(2) : '0.00';
  const hsn = invoice.hsn_code || '08011210';
  const qtyKg = Number(invoice.total_weight_kg || 0).toFixed(2);
  const rateKg = Number(invoice.rate_per_kg || 0).toFixed(2);
  const lorryNo = invoice.lorry_no || '';
  const invNo = invoice.invoice_no || '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>COCONUT EXPORT ENTERPRISE</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${vchDate}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${invNo}</VOUCHERNUMBER>
            <REFERENCE>${invNo}</REFERENCE>
            <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>
            <BASICBUYERNAME>${partyName}</BASICBUYERNAME>
            <BASICBUYERADDRESS.LIST>
              <BASICBUYERADDRESS>${invoice.buyer_address || 'Belagavi, Karnataka'}</BASICBUYERADDRESS>
            </BASICBUYERADDRESS.LIST>
            <STATENAME>${invoice.state_name || 'Karnataka'}</STATENAME>
            <PLACEOFSUPPLY>${invoice.state_name || 'Karnataka'}</PLACEOFSUPPLY>
            <PARTYGSTIN>${invoice.buyer_gstin || ''}</PARTYGSTIN>
            <NARRATION>Coconut Export consignment via Lorry ${lorryNo}. Net Weight: ${qtyKg} Kgs @ Rs.${rateKg}/Kg. Bags: ${invoice.bag_count || 0}.</NARRATION>
            
            <!-- Buyer Ledger (Debtor) Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${totalAmt}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Sales Account Ledger Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Coconut Export Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${taxableVal}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            ${isInterstate && Number(igstAmt) > 0 ? `
            <!-- IGST Ledger Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output IGST 5%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${igstAmt}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : ''}

            ${!isInterstate && Number(cgstAmt) > 0 ? `
            <!-- CGST Ledger Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST 2.5%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${cgstAmt}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <!-- SGST Ledger Entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST 2.5%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${sgstAmt}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : ''}

            <!-- Inventory Allocation Details -->
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${invoice.product_description || 'Fresh Semi-Husked Coconuts'}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <RATE>${rateKg}/Kg</RATE>
              <AMOUNT>${taxableVal}</AMOUNT>
              <ACTUALQTY>${qtyKg} Kgs</ACTUALQTY>
              <BILLEDQTY>${qtyKg} Kgs</BILLEDQTY>
              <HSNCODE>${hsn}</HSNCODE>
            </ALLINVENTORYENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// Convert table rows to CSV
function toCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(h => `"${h}"`).join(',');
  const lines = rows.map(r => {
    return headers.map(h => {
      const val = r[h] == null ? '' : String(r[h]).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
  });
  return [headerLine, ...lines].join('\r\n');
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Enable CORS
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // -------------------------------------------------------------
    // API ROUTES
    // -------------------------------------------------------------

    // --- DASHBOARD SUMMARY ---
    if (pathname === '/api/summary' && method === 'GET') {
      const sales = db.prepare('SELECT SUM(total_invoice_amount) as totalSales, SUM(dd_amount) as totalReceived, SUM(balance_due) as totalReceivable, COUNT(*) as invoiceCount FROM export_invoices').get();
      const cashCredit = db.prepare("SELECT SUM(amount) as totalCredit FROM cash_book WHERE entry_type = 'credit'").get();
      const cashDebit = db.prepare("SELECT SUM(amount) as totalDebit FROM cash_book WHERE entry_type = 'debit'").get();
      const harvest = db.prepare('SELECT SUM(quantity_count) as totalNuts, SUM(gross_amount) as totalHarvestValue, SUM(advance_paid) as totalHarvestAdvance, SUM(net_payable) as totalHarvestPending FROM farmer_procurements').get();
      const dehusking = db.prepare('SELECT SUM(count_4p + count_mo + count_pl) as totalDehusked, SUM(gross_wage) as totalWageEarned, SUM(utility_advance) as totalUtilityAdvances, SUM(net_balance) as totalPendingBulkPay FROM dehusking_records').get();
      const loadman = db.prepare('SELECT SUM(coolie) as totalLoadCoolie, SUM(advance_paid) as totalLoadAdvance, SUM(batta) as totalBatta FROM loadman_records').get();
      const husk = db.prepare('SELECT SUM(total_amount) as totalHuskValue, SUM(paid_amount) as totalHuskPaid, SUM(balance_amount) as totalHuskBalance FROM husk_purchases').get();
      const recentCash = db.prepare('SELECT * FROM cash_book ORDER BY date DESC, id DESC LIMIT 6').all();
      const recentInvoices = db.prepare('SELECT * FROM export_invoices ORDER BY invoice_date DESC, id DESC LIMIT 5').all();
      const managerExp = db.prepare("SELECT SUM(amount) as totalFuel FROM manager_expenses WHERE expense_type IN ('petrol', 'diesel')").get();

      const creditAmt = cashCredit.totalCredit || 0;
      const debitAmt = cashDebit.totalDebit || 0;
      const cashInHand = creditAmt - debitAmt;

      return sendJson(res, {
        sales: {
          totalSales: sales.totalSales || 0,
          totalReceived: sales.totalReceived || 0,
          totalReceivable: sales.totalReceivable || 0,
          invoiceCount: sales.invoiceCount || 0
        },
        cashBook: {
          totalCredit: creditAmt,
          totalDebit: debitAmt,
          cashInHand: cashInHand
        },
        harvest: {
          totalNuts: harvest.totalNuts || 0,
          totalHarvestValue: harvest.totalHarvestValue || 0,
          totalHarvestAdvance: harvest.totalHarvestAdvance || 0,
          totalHarvestPending: harvest.totalHarvestPending || 0
        },
        dehusking: {
          totalDehusked: dehusking.totalDehusked || 0,
          totalWageEarned: dehusking.totalWageEarned || 0,
          totalUtilityAdvances: dehusking.totalUtilityAdvances || 0,
          totalPendingBulkPay: dehusking.totalPendingBulkPay || 0
        },
        loadman: {
          totalLoadCoolie: loadman.totalLoadCoolie || 0,
          totalLoadAdvance: loadman.totalLoadAdvance || 0,
          totalBatta: loadman.totalBatta || 0
        },
        husk: {
          totalHuskValue: husk.totalHuskValue || 0,
          totalHuskPaid: husk.totalHuskPaid || 0,
          totalHuskBalance: husk.totalHuskBalance || 0
        },
        managerFuel: managerExp.totalFuel || 0,
        recentCash,
        recentInvoices
      });
    }

    // --- FARMERS DIRECTORY ---
    if (pathname === '/api/farmers') {
      if (method === 'GET') {
        const farmers = db.prepare('SELECT * FROM farmers ORDER BY name ASC').all();
        return sendJson(res, farmers);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.name) return sendError(res, 'Farmer name is required');
        const stmt = db.prepare(`
          INSERT INTO farmers (name, phone, village, bank_name, account_no, ifsc_code, upi_id, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.name, body.phone || '', body.village || '', body.bank_name || '',
          body.account_no || '', body.ifsc_code || '', body.upi_id || '', body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid) }, 201);
      }
    }

    if (pathname.startsWith('/api/farmers/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      const body = await parseJsonBody(req);
      const stmt = db.prepare(`
        UPDATE farmers SET name=?, phone=?, village=?, bank_name=?, account_no=?, ifsc_code=?, upi_id=?, notes=?
        WHERE id=?
      `);
      stmt.run(
        body.name, body.phone || '', body.village || '', body.bank_name || '',
        body.account_no || '', body.ifsc_code || '', body.upi_id || '', body.notes || '', id
      );
      return sendJson(res, { success: true });
    }

    if (pathname.startsWith('/api/farmers/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM farmers WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- FARMER PROCUREMENT (INCOMING COCONUTS) ---
    if (pathname === '/api/procurements') {
      if (method === 'GET') {
        const records = db.prepare('SELECT p.*, f.phone, f.village, f.bank_name, f.account_no, f.ifsc_code FROM farmer_procurements p LEFT JOIN farmers f ON p.farmer_id = f.id ORDER BY p.date DESC, p.id DESC').all();
        return sendJson(res, records);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const qtyCount = Number(body.quantity_count || 0);
        const qtyKg = Number(body.quantity_kg || 0);
        const rate = Number(body.unit_rate || 0);
        const plucking = Number(body.plucking_coolie || 0);
        const transport = Number(body.transport_deduction || 0);
        const advance = Number(body.advance_paid || 0);
        const gross = qtyCount > 0 ? (qtyCount * rate) : (qtyKg * rate);
        const net = gross - plucking - transport - advance;

        const stmt = db.prepare(`
          INSERT INTO farmer_procurements (
            farmer_id, farmer_name, date, batch_no, coconut_type, quantity_count,
            quantity_kg, unit_rate, gross_amount, plucking_coolie, transport_deduction,
            advance_paid, net_payable, payment_status, payment_date, payment_mode, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.farmer_id || null, body.farmer_name, body.date, body.batch_no || '',
          body.coconut_type || 'Fresh Coconut / பச்சை தேங்காய்', qtyCount, qtyKg, rate,
          gross, plucking, transport, advance, net, body.payment_status || 'Pending',
          body.payment_date || null, body.payment_mode || 'Bank Transfer', body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid), gross_amount: gross, net_payable: net }, 201);
      }
    }

    if (pathname.startsWith('/api/procurements/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      const body = await parseJsonBody(req);
      const qtyCount = Number(body.quantity_count || 0);
      const qtyKg = Number(body.quantity_kg || 0);
      const rate = Number(body.unit_rate || 0);
      const plucking = Number(body.plucking_coolie || 0);
      const transport = Number(body.transport_deduction || 0);
      const advance = Number(body.advance_paid || 0);
      const gross = qtyCount > 0 ? (qtyCount * rate) : (qtyKg * rate);
      const net = gross - plucking - transport - advance;

      const stmt = db.prepare(`
        UPDATE farmer_procurements SET
          farmer_id=?, farmer_name=?, date=?, batch_no=?, coconut_type=?, quantity_count=?,
          quantity_kg=?, unit_rate=?, gross_amount=?, plucking_coolie=?, transport_deduction=?,
          advance_paid=?, net_payable=?, payment_status=?, payment_date=?, payment_mode=?, notes=?
        WHERE id=?
      `);
      stmt.run(
        body.farmer_id || null, body.farmer_name, body.date, body.batch_no || '',
        body.coconut_type || 'Fresh Coconut / பச்சை தேங்காய்', qtyCount, qtyKg, rate,
        gross, plucking, transport, advance, net, body.payment_status || 'Pending',
        body.payment_date || null, body.payment_mode || 'Bank Transfer', body.notes || '', id
      );
      return sendJson(res, { success: true, gross_amount: gross, net_payable: net });
    }

    if (pathname.startsWith('/api/procurements/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM farmer_procurements WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- COCONUT HUSK (MATTAI) PURCHASES ---
    if (pathname === '/api/husk') {
      if (method === 'GET') {
        const records = db.prepare('SELECT * FROM husk_purchases ORDER BY date DESC, id DESC').all();
        return sendJson(res, records);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const trips = Number(body.trips || 0);
        const tripRate = Number(body.trip_rate || 0);
        const nutCount = Number(body.nut_count || 0);
        const nutRate = Number(body.nut_rate || 0);
        const total = (trips * tripRate) + (nutCount * nutRate);
        const paid = Number(body.paid_amount || 0);
        const balance = total - paid;

        const stmt = db.prepare(`
          INSERT INTO husk_purchases (
            supplier_id, supplier_name, date, vehicle_no, husk_category, trips,
            trip_rate, nut_count, nut_rate, total_amount, payment_mode, paid_amount,
            balance_amount, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.supplier_id || null, body.supplier_name, body.date, body.vehicle_no || 'Eicher Lorry',
          body.husk_category || 'KN மட்டை', trips, tripRate, nutCount, nutRate, total,
          body.payment_mode || 'Canara Bank', paid, balance, body.status || 'Settled', body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid), total_amount: total, balance_amount: balance }, 201);
      }
    }

    if (pathname.startsWith('/api/husk/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      const body = await parseJsonBody(req);
      const trips = Number(body.trips || 0);
      const tripRate = Number(body.trip_rate || 0);
      const nutCount = Number(body.nut_count || 0);
      const nutRate = Number(body.nut_rate || 0);
      const total = (trips * tripRate) + (nutCount * nutRate);
      const paid = Number(body.paid_amount || 0);
      const balance = total - paid;

      const stmt = db.prepare(`
        UPDATE husk_purchases SET
          supplier_name=?, date=?, vehicle_no=?, husk_category=?, trips=?,
          trip_rate=?, nut_count=?, nut_rate=?, total_amount=?, payment_mode=?,
          paid_amount=?, balance_amount=?, status=?, notes=?
        WHERE id=?
      `);
      stmt.run(
        body.supplier_name, body.date, body.vehicle_no || 'Eicher Lorry',
        body.husk_category || 'KN மட்டை', trips, tripRate, nutCount, nutRate, total,
        body.payment_mode || 'Canara Bank', paid, balance, body.status || 'Settled', body.notes || '', id
      );
      return sendJson(res, { success: true, total_amount: total, balance_amount: balance });
    }

    if (pathname.startsWith('/api/husk/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM husk_purchases WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- WORKERS DIRECTORY ---
    if (pathname === '/api/workers') {
      if (method === 'GET') {
        const workers = db.prepare('SELECT * FROM workers ORDER BY name ASC').all();
        return sendJson(res, workers);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.name) return sendError(res, 'Worker name is required');
        const stmt = db.prepare(`
          INSERT INTO workers (name, village, phone, worker_type, group_name, fixed_daily_wage, monthly_salary, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.name, body.village || '', body.phone || '', body.worker_type || 'individual_dehusker',
          body.group_name || '', Number(body.fixed_daily_wage || 0), Number(body.monthly_salary || 0), body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid) }, 201);
      }
    }

    // --- DE-HUSKING RECORDS (PIECE RATE) ---
    if (pathname === '/api/dehusking') {
      if (method === 'GET') {
        const records = db.prepare('SELECT * FROM dehusking_records ORDER BY date DESC, id DESC').all();
        return sendJson(res, records);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const c4p = Number(body.count_4p || 0);
        const r4p = Number(body.rate_4p || 0.90);
        const cmo = Number(body.count_mo || 0);
        const rmo = Number(body.rate_mo || 0.70);
        const cpl = Number(body.count_pl || 0);
        const rpl = Number(body.rate_pl || 1.00);
        const utilityAdv = Number(body.utility_advance || 0);
        const gross = (c4p * r4p) + (cmo * rmo) + (cpl * rpl);
        const net = gross - utilityAdv;

        const stmt = db.prepare(`
          INSERT INTO dehusking_records (
            worker_id, worker_name, date, work_type, count_4p, rate_4p, count_mo,
            rate_mo, count_pl, rate_pl, gross_wage, utility_advance, net_balance,
            settlement_status, settled_date, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.worker_id || null, body.worker_name, body.date, body.work_type || 'individual',
          c4p, r4p, cmo, rmo, cpl, rpl, gross, utilityAdv, net,
          body.settlement_status || 'pending_home_departure', body.settled_date || null, body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid), gross_wage: gross, net_balance: net }, 201);
      }
    }

    if (pathname.startsWith('/api/dehusking/') && method === 'PUT') {
      const parts = pathname.split('/');
      const id = parts[3];
      if (parts[4] === 'settle') {
        // Mark bulk home settlement
        const today = new Date().toISOString().split('T')[0];
        db.prepare("UPDATE dehusking_records SET settlement_status = 'settled_bulk', settled_date = ? WHERE id = ?").run(today, id);
        return sendJson(res, { success: true, settled_date: today });
      }

      const body = await parseJsonBody(req);
      const c4p = Number(body.count_4p || 0);
      const r4p = Number(body.rate_4p || 0.90);
      const cmo = Number(body.count_mo || 0);
      const rmo = Number(body.rate_mo || 0.70);
      const cpl = Number(body.count_pl || 0);
      const rpl = Number(body.rate_pl || 1.00);
      const utilityAdv = Number(body.utility_advance || 0);
      const gross = (c4p * r4p) + (cmo * rmo) + (cpl * rpl);
      const net = gross - utilityAdv;

      const stmt = db.prepare(`
        UPDATE dehusking_records SET
          worker_name=?, date=?, work_type=?, count_4p=?, rate_4p=?, count_mo=?,
          rate_mo=?, count_pl=?, rate_pl=?, gross_wage=?, utility_advance=?,
          net_balance=?, settlement_status=?, settled_date=?, notes=?
        WHERE id=?
      `);
      stmt.run(
        body.worker_name, body.date, body.work_type || 'individual',
        c4p, r4p, cmo, rmo, cpl, rpl, gross, utilityAdv, net,
        body.settlement_status || 'pending_home_departure', body.settled_date || null, body.notes || '', id
      );
      return sendJson(res, { success: true, gross_wage: gross, net_balance: net });
    }

    if (pathname.startsWith('/api/dehusking/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM dehusking_records WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- CARRIERS & DRIVERS FIXED WAGES ---
    if (pathname === '/api/carrier-wages') {
      if (method === 'GET') {
        const records = db.prepare('SELECT * FROM carrier_wages ORDER BY date DESC, id DESC').all();
        return sendJson(res, records);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const rate = Number(body.daily_fixed_rate || 0);
        const advance = Number(body.utility_advance || 0);
        const net = rate - advance;
        const stmt = db.prepare(`
          INSERT INTO carrier_wages (worker_id, worker_name, role, date, attendance, daily_fixed_rate, utility_advance, net_payable, payment_status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.worker_id || null, body.worker_name, body.role || 'carrier', body.date,
          body.attendance || 'present', rate, advance, net, body.payment_status || 'Paid', body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid) }, 201);
      }
    }

    if (pathname.startsWith('/api/carrier-wages/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM carrier_wages WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- LOADMAN RECORDS (SIVAPANDI CHETTY) ---
    if (pathname === '/api/loadman') {
      if (method === 'GET') {
        const records = db.prepare('SELECT * FROM loadman_records ORDER BY date DESC, id DESC').all();
        return sendJson(res, records);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const coolie = Number(body.coolie || 0);
        const adv = Number(body.advance_paid || 0);
        const bal = coolie - adv;
        const stmt = db.prepare(`
          INSERT INTO loadman_records (contractor_name, date, lorry_no, load_details, batta, coolie, advance_paid, balance, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.contractor_name || 'திரு. சிவபாண்டி செட்டி', body.date, body.lorry_no || '',
          body.load_details || '', Number(body.batta || 0), coolie, adv, bal, body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid) }, 201);
      }
    }

    if (pathname.startsWith('/api/loadman/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM loadman_records WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- GROUP GRADING BY GUNNY BAG VARIANT ---
    if (pathname === '/api/group-grading') {
      if (method === 'GET') {
        const records = db.prepare('SELECT * FROM group_gradings ORDER BY date DESC, id DESC').all();
        return sendJson(res, records);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const bagCount = Number(body.bag_count || 0);
        const pcsPerBag = Number(body.piece_count_per_bag || 0);
        const totalPcs = bagCount * pcsPerBag;
        const rateBag = Number(body.rate_per_bag || 0);
        const totalWage = bagCount * rateBag;
        const utilAdv = Number(body.utility_advance || 0);
        const bulkPaid = totalWage - utilAdv;

        const stmt = db.prepare(`
          INSERT INTO group_gradings (
            date, vehicle_no, group_name, gunny_bag_variant, bag_count, piece_count_per_bag,
            total_pieces, rate_per_bag, total_wage, utility_advance, final_bulk_paid, settlement_status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.date, body.vehicle_no || '', body.group_name, body.gunny_bag_variant,
          bagCount, pcsPerBag, totalPcs, rateBag, totalWage, utilAdv, bulkPaid,
          body.settlement_status || 'Settled', body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid) }, 201);
      }
    }

    if (pathname.startsWith('/api/group-grading/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM group_gradings WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- TRANSPORT & LORRY DISPATCH ---
    if (pathname === '/api/dispatch') {
      if (method === 'GET') {
        const records = db.prepare('SELECT * FROM transport_dispatches ORDER BY date DESC, id DESC').all();
        return sendJson(res, records);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const freight = Number(body.freight_amount || 0);
        const advFreight = Number(body.advance_freight || 0);
        const balFreight = freight - advFreight;
        const stmt = db.prepare(`
          INSERT INTO transport_dispatches (
            date, lorry_no, broker_agency, route_from, route_to, driver_name, driver_phone,
            driver_wage, vehicle_rent, freight_amount, advance_freight, balance_freight,
            cargo_weight_kg, total_bags, bag_details_json, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.date, body.lorry_no, body.broker_agency || '', body.route_from || 'Thennalapatti',
          body.route_to || '', body.driver_name || '', body.driver_phone || '',
          Number(body.driver_wage || 0), Number(body.vehicle_rent || 0),
          freight, advFreight, balFreight, Number(body.cargo_weight_kg || 0),
          Number(body.total_bags || 0), body.bag_details_json || '[]', body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid) }, 201);
      }
    }

    if (pathname.startsWith('/api/dispatch/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM transport_dispatches WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- MANAGER FUEL & TRAVEL EXPENSES ---
    if (pathname === '/api/manager-expenses') {
      if (method === 'GET') {
        const records = db.prepare('SELECT * FROM manager_expenses ORDER BY date DESC, id DESC').all();
        return sendJson(res, records);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const stmt = db.prepare(`
          INSERT INTO manager_expenses (date, manager_name, vehicle_no, expense_type, voucher_no, amount, debit_credit, meter_reading, payment_mode, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.date, body.manager_name, body.vehicle_no || '', body.expense_type || 'petrol',
          body.voucher_no || '', Number(body.amount || 0), body.debit_credit || 'debit',
          body.meter_reading || '', body.payment_mode || 'Cash', body.notes || ''
        );
        // Also log automatically into Cash Book
        db.prepare(`
          INSERT INTO cash_book (date, voucher_no, entry_type, category, particulars, amount, payment_mode, notes)
          VALUES (?, ?, 'debit', 'Petrol & Fuel', ?, ?, ?, ?)
        `).run(
          body.date, body.voucher_no || '',
          `${body.manager_name} - ${body.expense_type.toUpperCase()} (${body.vehicle_no || 'Manager Vehicle'})`,
          Number(body.amount || 0), body.payment_mode || 'Cash', 'Auto-logged from Manager Expense'
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid) }, 201);
      }
    }

    if (pathname.startsWith('/api/manager-expenses/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM manager_expenses WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- MANAGER SALARIES ---
    if (pathname === '/api/manager-salaries') {
      if (method === 'GET') {
        const records = db.prepare('SELECT * FROM manager_salaries ORDER BY month_year DESC, id DESC').all();
        return sendJson(res, records);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const salary = Number(body.monthly_salary || 0);
        const advances = Number(body.advances_taken || 0);
        const deductions = Number(body.other_deductions || 0);
        const net = salary - advances - deductions;
        const stmt = db.prepare(`
          INSERT INTO manager_salaries (manager_name, month_year, monthly_salary, advances_taken, other_deductions, net_salary_paid, payment_date, payment_mode, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.manager_name, body.month_year, salary, advances, deductions, net,
          body.payment_date || null, body.payment_mode || 'Bank Transfer', body.status || 'Paid', body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid) }, 201);
      }
    }

    // --- BUYERS (EXPORT & WHOLESALE) ---
    if (pathname === '/api/buyers') {
      if (method === 'GET') {
        const buyers = db.prepare('SELECT * FROM buyers ORDER BY trade_name ASC').all();
        return sendJson(res, buyers);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const stmt = db.prepare(`
          INSERT INTO buyers (trade_name, contact_person, phone, email, gstin, address, market_city, state_name, state_code, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.trade_name, body.contact_person || '', body.phone || '', body.email || '',
          body.gstin || '', body.address || '', body.market_city || '', body.state_name || 'Karnataka',
          body.state_code || '29', body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid) }, 201);
      }
    }

    // --- EXPORT INVOICES (TALLY COMPLIANT) ---
    if (pathname === '/api/invoices') {
      if (method === 'GET') {
        const invoices = db.prepare('SELECT * FROM export_invoices ORDER BY invoice_date DESC, id DESC').all();
        return sendJson(res, invoices);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.invoice_no) return sendError(res, 'Invoice Number is required');

        const weightKg = Number(body.total_weight_kg || 0);
        const rateKg = Number(body.rate_per_kg || 0);
        const discount = Number(body.discount_amount || 0);
        const taxable = (weightKg * rateKg) - discount;
        const isInterstate = Number(body.is_interstate ?? 1);
        let igstRate = 0, igstAmt = 0, cgstRate = 0, cgstAmt = 0, sgstRate = 0, sgstAmt = 0;

        if (isInterstate === 1) {
          igstRate = Number(body.igst_rate ?? 5.0);
          igstAmt = (taxable * igstRate) / 100;
        } else {
          cgstRate = 2.5;
          sgstRate = 2.5;
          cgstAmt = (taxable * cgstRate) / 100;
          sgstAmt = (taxable * sgstRate) / 100;
        }

        const totalInvoice = taxable + igstAmt + cgstAmt + sgstAmt;
        const ddAmt = Number(body.dd_amount || 0);
        const balDue = totalInvoice - ddAmt;
        const status = balDue <= 0 ? 'Paid' : (ddAmt > 0 ? 'Partial' : 'Pending');

        const stmt = db.prepare(`
          INSERT INTO export_invoices (
            invoice_no, invoice_date, buyer_id, buyer_name, buyer_gstin, buyer_address,
            lorry_no, hsn_code, product_description, bag_count, total_weight_kg, rate_per_kg,
            taxable_value, discount_amount, is_interstate, igst_rate, igst_amount,
            cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_invoice_amount,
            dd_receipt_date, dd_amount, bank_name, balance_due, payment_status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
          body.invoice_no, body.invoice_date, body.buyer_id || null, body.buyer_name,
          body.buyer_gstin || '', body.buyer_address || '', body.lorry_no || '',
          body.hsn_code || '08011210', body.product_description || 'Fresh Semi-Husked Coconuts (தேங்காய்)',
          Number(body.bag_count || 0), weightKg, rateKg, taxable, discount,
          isInterstate, igstRate, igstAmt, cgstRate, cgstAmt, sgstRate, sgstAmt,
          totalInvoice, body.dd_receipt_date || null, ddAmt, body.bank_name || 'Canara Bank',
          balDue, status, body.notes || ''
        );

        return sendJson(res, {
          success: true,
          id: Number(result.lastInsertRowid),
          total_invoice_amount: totalInvoice,
          balance_due: balDue,
          payment_status: status
        }, 201);
      }
    }

    if (pathname.startsWith('/api/invoices/') && pathname.endsWith('/tally-xml') && method === 'GET') {
      const id = pathname.split('/')[3];
      const invoice = db.prepare('SELECT * FROM export_invoices WHERE id=?').get(id);
      if (!invoice) return sendError(res, 'Invoice not found', 404);

      const xml = generateTallyXml(invoice);
      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="Tally_Invoice_${invoice.invoice_no}.xml"`
      });
      return res.end(xml);
    }

    if (pathname.startsWith('/api/invoices/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      const body = await parseJsonBody(req);
      const weightKg = Number(body.total_weight_kg || 0);
      const rateKg = Number(body.rate_per_kg || 0);
      const discount = Number(body.discount_amount || 0);
      const taxable = (weightKg * rateKg) - discount;
      const isInterstate = Number(body.is_interstate ?? 1);
      let igstRate = 0, igstAmt = 0, cgstRate = 0, cgstAmt = 0, sgstRate = 0, sgstAmt = 0;

      if (isInterstate === 1) {
        igstRate = Number(body.igst_rate ?? 5.0);
        igstAmt = (taxable * igstRate) / 100;
      } else {
        cgstRate = 2.5;
        sgstRate = 2.5;
        cgstAmt = (taxable * cgstRate) / 100;
        sgstAmt = (taxable * sgstRate) / 100;
      }

      const totalInvoice = taxable + igstAmt + cgstAmt + sgstAmt;
      const ddAmt = Number(body.dd_amount || 0);
      const balDue = totalInvoice - ddAmt;
      const status = balDue <= 0 ? 'Paid' : (ddAmt > 0 ? 'Partial' : 'Pending');

      const stmt = db.prepare(`
        UPDATE export_invoices SET
          invoice_no=?, invoice_date=?, buyer_id=?, buyer_name=?, buyer_gstin=?, buyer_address=?,
          lorry_no=?, hsn_code=?, product_description=?, bag_count=?, total_weight_kg=?, rate_per_kg=?,
          taxable_value=?, discount_amount=?, is_interstate=?, igst_rate=?, igst_amount=?,
          cgst_rate=?, cgst_amount=?, sgst_rate=?, sgst_amount=?, total_invoice_amount=?,
          dd_receipt_date=?, dd_amount=?, bank_name=?, balance_due=?, payment_status=?, notes=?
        WHERE id=?
      `);

      stmt.run(
        body.invoice_no, body.invoice_date, body.buyer_id || null, body.buyer_name,
        body.buyer_gstin || '', body.buyer_address || '', body.lorry_no || '',
        body.hsn_code || '08011210', body.product_description || 'Fresh Semi-Husked Coconuts (தேங்காய்)',
        Number(body.bag_count || 0), weightKg, rateKg, taxable, discount,
        isInterstate, igstRate, igstAmt, cgstRate, cgstAmt, sgstRate, sgstAmt,
        totalInvoice, body.dd_receipt_date || null, ddAmt, body.bank_name || 'Canara Bank',
        balDue, status, body.notes || '', id
      );

      return sendJson(res, { success: true, total_invoice_amount: totalInvoice, balance_due: balDue });
    }

    if (pathname.startsWith('/api/invoices/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM export_invoices WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- CASH & BANK BOOK (DOUBLE ENTRY / DEBIT & CREDIT) ---
    if (pathname === '/api/cash-book') {
      if (method === 'GET') {
        const records = db.prepare('SELECT * FROM cash_book ORDER BY date DESC, id DESC').all();
        return sendJson(res, records);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.particulars || !body.amount) return sendError(res, 'Particulars and amount are required');
        const stmt = db.prepare(`
          INSERT INTO cash_book (date, voucher_no, entry_type, category, particulars, amount, payment_mode, ref_id, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.date, body.voucher_no || `VCH-${Date.now().toString().slice(-4)}`,
          body.entry_type || 'debit', body.category || 'Other', body.particulars,
          Number(body.amount || 0), body.payment_mode || 'Cash', body.ref_id || '', body.notes || ''
        );
        return sendJson(res, { success: true, id: Number(result.lastInsertRowid) }, 201);
      }
    }

    if (pathname.startsWith('/api/cash-book/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.prepare('DELETE FROM cash_book WHERE id=?').run(id);
      return sendJson(res, { success: true });
    }

    // --- CSV EXPORT GENERATOR ---
    if (pathname.startsWith('/api/export-csv/')) {
      const table = pathname.split('/')[3];
      let rows = [];
      let filename = 'export.csv';

      if (table === 'invoices') {
        rows = db.prepare('SELECT * FROM export_invoices ORDER BY invoice_date DESC').all();
        filename = 'Coconut_Export_Invoices.csv';
      } else if (table === 'cash-book') {
        rows = db.prepare('SELECT * FROM cash_book ORDER BY date DESC').all();
        filename = 'Cash_Book_Ledger.csv';
      } else if (table === 'procurements') {
        rows = db.prepare('SELECT * FROM farmer_procurements ORDER BY date DESC').all();
        filename = 'Farmer_Procurements.csv';
      } else if (table === 'dehusking') {
        rows = db.prepare('SELECT * FROM dehusking_records ORDER BY date DESC').all();
        filename = 'Dehusking_Wages.csv';
      } else if (table === 'husk') {
        rows = db.prepare('SELECT * FROM husk_purchases ORDER BY date DESC').all();
        filename = 'Husk_Purchases.csv';
      } else if (table === 'loadman') {
        rows = db.prepare('SELECT * FROM loadman_records ORDER BY date DESC').all();
        filename = 'Loadman_Coolie.csv';
      } else if (table === 'dispatch') {
        rows = db.prepare('SELECT * FROM transport_dispatches ORDER BY date DESC').all();
        filename = 'Transport_Dispatches.csv';
      }

      const csvData = toCsv(rows);
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      });
      return res.end(csvData);
    }

    // --- NOTEBOOK ARCHIVE METADATA (16 PAGES DETAILED AUDIT) ---
    if (pathname === '/api/notebook-archive' && method === 'GET') {
      const archive = [
        {
          pageNumber: 1,
          type: 'Cover / Label',
          tamilTitle: 'லோடிங் வண்டித்தாள் நோட்டு',
          englishTitle: 'Loading & Transport Dispatch Sheet Note',
          period: 'Consignments from Kangeyampalayam',
          description: 'Label specifying format for outbound lorry dispatches, freight calculation, and driver details.',
          followingPages: [2],
          digitalModule: 'Transport & Lorry Dispatch (Module 6)'
        },
        {
          pageNumber: 2,
          type: 'Records',
          tamilTitle: 'லோடிங் கணக்கு & எடை விபரம்',
          englishTitle: 'Consignment Loading, Weight Slip & Freight',
          period: '12/04/2026',
          description: 'Lorry TN 38 AJ 4386 (M/s SD Transport) Thennalapatti TO Vadakara. 970 Bags, 47,950 units, Gross Wt: 17,130 kg, Freight: Rs. 49,700, Driver: 9751399029.',
          followingPages: [],
          digitalModule: 'Transport & Lorry Dispatch'
        },
        {
          pageNumber: 3,
          type: 'Cover / Label',
          tamilTitle: 'லோடுமேன் கூலிக்கு நோட்டு (20/10/2025 முதல்)',
          englishTitle: 'Loadman Labor Wages & Advance Ledger',
          period: '20/10/2025 Onwards',
          description: 'Defines schema for vehicle loading coolie per coconut grade (KN, 4P loose), daily batta, and advance deductions.',
          followingPages: [4],
          digitalModule: 'Loadman Coolie (Module 5)'
        },
        {
          pageNumber: 4,
          type: 'Records',
          tamilTitle: 'திரு. சிவபாண்டி செட்டி - அய்யம்பாளையம்',
          englishTitle: 'Thiru. Sivapandi Chetty - Loadman Account',
          period: '20/10/2025 to 20/11/2025',
          description: 'Detailed vehicle-by-vehicle loading coolie. Total Batta: 143, Total Coolie: Rs. 93,504, Total Advance: Rs. 177,500.',
          followingPages: [],
          digitalModule: 'Loadman Coolie'
        },
        {
          pageNumber: 5,
          type: 'Cover / Label',
          tamilTitle: 'மட்டை கொள்முதல் நோட்டு (01/04/2026 முதல்)',
          englishTitle: 'Coconut Husk Purchase & Supply Ledger',
          period: '01/04/2026 Onwards',
          description: 'Template for daily Eicher lorry trips of coconut husks (KN / MO mattai), rates per trip and per nut.',
          followingPages: [6, 7],
          digitalModule: 'Coconut Husk Purchases (Module 8)'
        },
        {
          pageNumber: 6,
          type: 'Records',
          tamilTitle: 'தினசரி மட்டை கொள்முதல் நடை விபரம்',
          englishTitle: 'Daily Husk Delivery Trip Logs',
          period: '01/04/2026 to 26/05/2026',
          description: 'Thiru. Balamurugan Nachipalayam / Rajakampalayam. 13 KN trips, 6 MO trips by Eicher lorry.',
          followingPages: [],
          digitalModule: 'Coconut Husk Purchases'
        },
        {
          pageNumber: 7,
          type: 'Records',
          tamilTitle: 'திரு. பாலமுருகன் மட்டை கணக்கு தீர்வு',
          englishTitle: 'Balamurugan Husk Final Billing & Bank Settlements',
          period: '01/04/2026 to 25/05/2026',
          description: '16 3/4 trips @ 13500 (Rs. 2,26,125) + 53,310 nuts @ 1.25 (Rs. 66,637) = Rs. 2,92,762. Paid via Canara Bank in installments.',
          followingPages: [],
          digitalModule: 'Coconut Husk Purchases'
        },
        {
          pageNumber: 8,
          type: 'Cover / Label',
          tamilTitle: 'வரவு - செலவு தினசரி நோட்டு (01/04/2026 முதல்)',
          englishTitle: 'Daily Cash Book & Operational Journal',
          period: '01/04/2026 Onwards',
          description: 'Double-column daily cash register for petrol, harvest picking, loading, packing, and bank deposits.',
          followingPages: [9, 10],
          digitalModule: 'Cash & Bank Book (Module 10)'
        },
        {
          pageNumber: 9,
          type: 'Records',
          tamilTitle: 'வரவு - செலவு பதிவு (பக்கம் 21)',
          englishTitle: 'Daily Receipts & Payments Journal - Page 21',
          period: '14/04/2026',
          description: 'Pulsar petrol Rs.500, cement pillars Rs.600, Andhra net vessels Rs.950, carrier wages (Saravanan, Muthu, Chandran), picking 11670 nuts Rs.2050, bank cash Rs.50000.',
          followingPages: [],
          digitalModule: 'Cash & Bank Book'
        },
        {
          pageNumber: 10,
          type: 'Records',
          tamilTitle: 'வரவு - செலவு பதிவு (பக்கம் 22)',
          englishTitle: 'Daily Receipts & Payments Journal - Page 22',
          period: '22/04/2026',
          description: 'SBI online receipt Rs.400000 (Ajith Kumar A/c), Suresh/Ganesan advances, cooking batta, tractor picking 14560 nuts Rs.2550, diesel, packing Rs.3300.',
          followingPages: [],
          digitalModule: 'Cash & Bank Book'
        },
        {
          pageNumber: 11,
          type: 'Cover / Label',
          tamilTitle: 'Parties Note 2026 to 2027 முதல்',
          englishTitle: 'Wholesale & Export Buyer Ledger 2026-2027',
          period: '2026 to 2027',
          description: 'B2B commercial export billing structure: GSTIN, Lorry, Bags, Weight (kg), Rate/kg, Total Bill, Demand Draft (DD) and Bank.',
          followingPages: [12],
          digitalModule: 'Export Invoicing & Parties (Module 7)'
        },
        {
          pageNumber: 12,
          type: 'Records',
          tamilTitle: 'M/s Shree Renuka Traders - பெலகாவி, கர்நாடகா',
          englishTitle: 'M/s Shree Renuka Traders (Belagavi, Karnataka)',
          period: '05/04/2026 to 09/09/2026',
          description: '11 export consignments. GSTIN: 29BDDPG0800P1ZK, Phone: 9743747349. Over 80,000 kgs exported, DD payments tracked via Canara Bank.',
          followingPages: [],
          digitalModule: 'Export Invoicing & Parties'
        },
        {
          pageNumber: 13,
          type: 'Cover / Label',
          tamilTitle: 'கிரையச் செலவு & உரியூர் குத்தகை நோட்டு (01/11/2024 முதல்)',
          englishTitle: 'Farm Lease, Procurement & Harvest Note',
          period: '01/11/2024 Onwards',
          description: 'Template for coconut harvest teams, daily coconut counts from groves, harvest coolie and bank advances.',
          followingPages: [14],
          digitalModule: 'Farmer Procurement & Harvest (Module 1)'
        },
        {
          pageNumber: 14,
          type: 'Records',
          tamilTitle: 'கணேசன் செட்டு - உரியூர் தோட்டம் அறுவடை',
          englishTitle: 'Ganesan Chettu - Uriyur Grove Harvesting',
          period: '02/11/2024 to 18/11/2024',
          description: 'Harvested 1,17,360 coconuts. Total advances paid: Rs. 94,300. Value: Rs. 99,756. Final cash payment: Rs. 8,500.',
          followingPages: [],
          digitalModule: 'Farmer Procurement & Harvest'
        },
        {
          pageNumber: 15,
          type: 'Cover / Label',
          tamilTitle: 'ஊழியர் கணக்கு நோட்டு (20/10/2025) - ஆர்த்தக்கடை',
          englishTitle: 'Employee Piece-Rate Processing & Peeling Wages Note',
          period: '2025 - 2026',
          description: 'Formula & template for coconut de-husking piece rates by grade: 4P (Paringai), MO (Mottai), PL (Parippu).',
          followingPages: [16],
          digitalModule: 'De-husking Labor (Module 3)'
        },
        {
          pageNumber: 16,
          type: 'Records',
          tamilTitle: 'முத்து - வாழப்பந்தல் உரிக்கும் கூலி கணக்கு',
          englishTitle: 'Muthu - Vazhapandal Peeling Wages Ledger',
          period: '28/11/2025 to 22/12/2025',
          description: '61,340 nuts dehusked (4P @ 900/1000, MO @ 700/1000, PL @ 1000/1000). Daily utility advances subtracted, bulk lump-sum settled upon departure.',
          followingPages: [],
          digitalModule: 'De-husking Labor'
        }
      ];

      return sendJson(res, archive);
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING (PUBLIC DIR)
    // -------------------------------------------------------------
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Access Denied');
    }

    // If file doesn't exist, fallback to index.html for SPA
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error loading file');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });

  } catch (err) {
    console.error('API Error:', err);
    sendError(res, err.message || 'Internal Server Error', 500);
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`COCONUT EXPORT BUSINESS MANAGEMENT SYSTEM`);
  console.log(`Server actively running at: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
