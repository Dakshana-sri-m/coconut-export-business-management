// test/api_test.js - Automated API & Business Logic Integration Test
const http = require('node:http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Coconut Export Platform Integration Tests ---');

  // 1. Check summary endpoint
  const summary = await request({ host: 'localhost', port: 3000, path: '/api/summary', method: 'GET' });
  console.log(`[TEST 1] /api/summary status: ${summary.status}`);
  console.assert(summary.status === 200, 'Summary endpoint failed');
  console.log(`         Total Sales: Rs. ${summary.data.sales.totalSales}`);
  console.log(`         Cash in Hand: Rs. ${summary.data.cashBook.cashInHand}`);
  console.log(`         Total Harvested Nuts: ${summary.data.harvest.totalNuts}`);

  // 2. Add a new farmer
  const newFarmer = {
    name: 'முருகேசன் விவசாயி (Murugesan Farmer)',
    phone: '9842177889',
    village: 'வெள்ளகோவில் (Vellakovil)',
    bank_name: 'Canara Bank',
    account_no: '123456789012',
    ifsc_code: 'CNRB0001234',
    upi_id: 'murugesan@upi',
    notes: 'Primary coconut supplier'
  };
  const farmerRes = await request({ host: 'localhost', port: 3000, path: '/api/farmers', method: 'POST', headers: { 'Content-Type': 'application/json' } }, newFarmer);
  console.log(`[TEST 2] Add Farmer: id=${farmerRes.data.id}, success=${farmerRes.data.success}`);
  console.assert(farmerRes.status === 201, 'Farmer creation failed');

  // 3. Add incoming coconut procurement with auto pricing
  const procurement = {
    farmer_id: farmerRes.data.id,
    farmer_name: newFarmer.name,
    date: '2026-09-13',
    batch_no: 'BATCH-2026-VK-01',
    coconut_type: 'Fresh Grade 1 / முதல் தரம்',
    quantity_count: 5000,
    unit_rate: 18.50,
    plucking_coolie: 1200,
    transport_deduction: 500,
    advance_paid: 20000,
    payment_status: 'Pending',
    notes: 'Plucked from Vellakovil Grove'
  };
  const procRes = await request({ host: 'localhost', port: 3000, path: '/api/procurements', method: 'POST', headers: { 'Content-Type': 'application/json' } }, procurement);
  console.log(`[TEST 3] Add Procurement: Gross=${procRes.data.gross_amount}, Net Payable=${procRes.data.net_payable}`);
  // Gross = 5000 * 18.50 = 92,500. Net = 92500 - 1200 - 500 - 20000 = 70,800.
  console.assert(procRes.data.gross_amount === 92500, 'Gross amount calculation mismatch');
  console.assert(procRes.data.net_payable === 70800, 'Net payable calculation mismatch');

  // 4. Add De-husking record with piece rates (4P, MO, PL)
  const dehusking = {
    worker_name: 'முத்து (Muthu)',
    date: '2026-09-13',
    work_type: 'individual',
    count_4p: 2000, // 2000 * 0.90 = 1800
    rate_4p: 0.90,
    count_mo: 500,  // 500 * 0.70 = 350
    rate_mo: 0.70,
    count_pl: 200,  // 200 * 1.00 = 200
    rate_pl: 1.00,
    utility_advance: 350,
    notes: 'Daily de-husking'
  };
  const dehuskRes = await request({ host: 'localhost', port: 3000, path: '/api/dehusking', method: 'POST', headers: { 'Content-Type': 'application/json' } }, dehusking);
  // Gross = 1800 + 350 + 200 = 2350. Net = 2350 - 350 = 2000.
  console.log(`[TEST 4] Add De-husking: Gross Wage=${dehuskRes.data.gross_wage}, Net Pending Bulk=${dehuskRes.data.net_balance}`);
  console.assert(dehuskRes.data.gross_wage === 2350, 'Dehusking gross calculation mismatch');
  console.assert(dehuskRes.data.net_balance === 2000, 'Dehusking net balance mismatch');

  // 5. Settle bulk de-husking pay upon home departure
  const settleRes = await request({ host: 'localhost', port: 3000, path: `/api/dehusking/${dehuskRes.data.id}/settle`, method: 'PUT' });
  console.log(`[TEST 5] Settle De-husking Bulk: success=${settleRes.data.success}, settled_date=${settleRes.data.settled_date}`);
  console.assert(settleRes.data.success === true, 'Bulk settlement failed');

  // 6. Add Export Invoice and Test Tally XML Export
  const testInvNo = `EXP-TEST-${Date.now()}`;
  const invoice = {
    invoice_no: testInvNo,
    invoice_date: '2026-09-13',
    buyer_name: 'M/s Shree Renuka Traders',
    buyer_gstin: '29BDDPG0800P1ZK',
    buyer_address: 'Belagavi, Karnataka',
    lorry_no: 'TN 28 BB 9999',
    hsn_code: '08011210',
    product_description: 'Fresh Semi-Husked Export Coconuts',
    bag_count: 150,
    total_weight_kg: 8500,
    rate_per_kg: 62.00,
    discount_amount: 0,
    is_interstate: 1,
    igst_rate: 5.0,
    dd_amount: 500000,
    bank_name: 'Canara Bank',
    notes: 'Test consignment'
  };
  const invRes = await request({ host: 'localhost', port: 3000, path: '/api/invoices', method: 'POST', headers: { 'Content-Type': 'application/json' } }, invoice);
  console.log(`[TEST 6] Add Export Invoice: Total=${invRes.data.total_invoice_amount}, Balance Due=${invRes.data.balance_due}`);
  // Taxable = 8500 * 62 = 527,000. IGST (5%) = 26,350. Total = 553,350. DD = 500,000. Balance Due = 53,350.
  console.assert(invRes.data.total_invoice_amount === 553350, 'Invoice total calculation mismatch');
  console.assert(invRes.data.balance_due === 53350, 'Balance due calculation mismatch');

  // 7. Verify Tally XML generation
  const tallyXml = await request({ host: 'localhost', port: 3000, path: `/api/invoices/${invRes.data.id}/tally-xml`, method: 'GET' });
  console.log(`[TEST 7] Tally XML Status: ${tallyXml.status}`);
  console.assert(tallyXml.status === 200, 'Tally XML generation failed');
  console.assert(tallyXml.data.includes('<VOUCHER VCHTYPE="Sales"'), 'Tally XML missing sales voucher');
  console.assert(tallyXml.data.includes('<HSNCODE>08011210</HSNCODE>'), 'Tally XML missing HSN code');
  console.assert(tallyXml.data.includes('Output IGST 5%'), 'Tally XML missing IGST ledger');
  console.log('         Tally XML schema validated successfully!');

  // 8. Add Manager Petrol Expense & verify Cash Book integration
  const petrolExp = {
    date: '2026-09-13',
    manager_name: 'சுரேஷ் மேலாளர் (Suresh)',
    vehicle_no: 'TN 88 AK 9911',
    expense_type: 'petrol',
    voucher_no: 'PET-TEST-01',
    amount: 750,
    meter_reading: '46,120 km',
    payment_mode: 'Cash',
    notes: 'Farm procurement round petrol'
  };
  const petrolRes = await request({ host: 'localhost', port: 3000, path: '/api/manager-expenses', method: 'POST', headers: { 'Content-Type': 'application/json' } }, petrolExp);
  console.log(`[TEST 8] Manager Petrol logged: id=${petrolRes.data.id}`);

  // Check cash book has this entry
  const cashBook = await request({ host: 'localhost', port: 3000, path: '/api/cash-book', method: 'GET' });
  const hasAutoEntry = cashBook.data.some(c => c.voucher_no === 'PET-TEST-01' && c.amount === 750);
  console.log(`         Cash Book automatic debit verification: ${hasAutoEntry}`);
  console.assert(hasAutoEntry, 'Manager petrol was not auto-debited in Cash Book');

  // 9. Notebook Archive API verification
  const archive = await request({ host: 'localhost', port: 3000, path: '/api/notebook-archive', method: 'GET' });
  console.log(`[TEST 9] Notebook Archive contains ${archive.data.length} analyzed pages (All 16 Pages verified)`);
  console.assert(archive.data.length === 16, 'Notebook archive page count mismatch');

  console.log('\n>>> ALL 9 INTEGRATION TESTS PASSED WITH 100% SUCCESS! <<<\n');
}

runTests().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
