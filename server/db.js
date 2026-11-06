// server/db.js - Database connection, schema and seed using built-in node:sqlite
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'coconut_export.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

function initSchema() {
  db.exec(`
    -- 1. Farmers Table (Incoming coconut sources)
    CREATE TABLE IF NOT EXISTS farmers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      village TEXT,
      bank_name TEXT,
      account_no TEXT,
      ifsc_code TEXT,
      upi_id TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Farmer Procurement / Incoming Batches
    CREATE TABLE IF NOT EXISTS farmer_procurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farmer_id INTEGER REFERENCES farmers(id) ON DELETE SET NULL,
      farmer_name TEXT,
      date TEXT NOT NULL,
      batch_no TEXT,
      coconut_type TEXT DEFAULT 'Fresh Coconut / பச்சை தேங்காய்',
      quantity_count INTEGER DEFAULT 0,
      quantity_kg REAL DEFAULT 0,
      unit_rate REAL DEFAULT 0,
      gross_amount REAL DEFAULT 0,
      plucking_coolie REAL DEFAULT 0,
      transport_deduction REAL DEFAULT 0,
      advance_paid REAL DEFAULT 0,
      net_payable REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'Pending',
      payment_date TEXT,
      payment_mode TEXT DEFAULT 'Bank Transfer',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Coconut Husk (Mattai) Suppliers & Purchases
    CREATE TABLE IF NOT EXISTS husk_suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      village TEXT,
      phone TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS husk_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER REFERENCES husk_suppliers(id) ON DELETE SET NULL,
      supplier_name TEXT NOT NULL,
      date TEXT NOT NULL,
      vehicle_no TEXT DEFAULT 'Eicher Lorry',
      husk_category TEXT DEFAULT 'KN மட்டை',
      trips REAL DEFAULT 1,
      trip_rate REAL DEFAULT 13500,
      nut_count INTEGER DEFAULT 0,
      nut_rate REAL DEFAULT 1.25,
      total_amount REAL DEFAULT 0,
      payment_mode TEXT DEFAULT 'Canara Bank',
      paid_amount REAL DEFAULT 0,
      balance_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'Settled',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Workers Directory (Individual / Group De-huskers, Carriers, Drivers, Managers)
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      village TEXT,
      phone TEXT,
      worker_type TEXT NOT NULL, -- 'individual_dehusker', 'group_dehusker', 'carrier', 'driver', 'manager', 'field_picker'
      group_name TEXT,
      fixed_daily_wage REAL DEFAULT 0,
      monthly_salary REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. De-husking Records (Piece-rate with 4P, MO, PL variants)
    CREATE TABLE IF NOT EXISTS dehusking_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
      worker_name TEXT NOT NULL,
      date TEXT NOT NULL,
      work_type TEXT DEFAULT 'individual', -- 'individual' or 'group'
      count_4p INTEGER DEFAULT 0,
      rate_4p REAL DEFAULT 0.90, -- Rs. 900 per 1000 nuts = 0.90 per nut
      count_mo INTEGER DEFAULT 0,
      rate_mo REAL DEFAULT 0.70, -- Rs. 700 per 1000 nuts = 0.70 per nut
      count_pl INTEGER DEFAULT 0,
      rate_pl REAL DEFAULT 1.00, -- Rs. 1000 per 1000 nuts = 1.00 per nut
      gross_wage REAL DEFAULT 0,
      utility_advance REAL DEFAULT 0, -- தினசரி படி / சிறிய முன்பணம்
      net_balance REAL DEFAULT 0,
      settlement_status TEXT DEFAULT 'pending_home_departure', -- 'pending_home_departure', 'settled_bulk', 'daily'
      settled_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Carriers & Drivers Daily Fixed Wage Ledger
    CREATE TABLE IF NOT EXISTS carrier_wages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
      worker_name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'carrier' (தூக்கும் ஆள்), 'driver', 'field_picker'
      date TEXT NOT NULL,
      attendance TEXT DEFAULT 'present', -- 'present', 'half_day', 'absent'
      daily_fixed_rate REAL DEFAULT 0,
      utility_advance REAL DEFAULT 0,
      net_payable REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'Paid',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Loadman Coolie (Sivapandi Chetty records)
    CREATE TABLE IF NOT EXISTS loadman_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contractor_name TEXT NOT NULL,
      date TEXT NOT NULL,
      lorry_no TEXT,
      load_details TEXT,
      batta INTEGER DEFAULT 0,
      coolie REAL DEFAULT 0,
      advance_paid REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. Group Grading by Gunny Bag Variant
    CREATE TABLE IF NOT EXISTS group_gradings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      vehicle_no TEXT,
      group_name TEXT NOT NULL,
      gunny_bag_variant TEXT NOT NULL,
      bag_count INTEGER DEFAULT 0,
      piece_count_per_bag INTEGER DEFAULT 0,
      total_pieces INTEGER DEFAULT 0,
      rate_per_bag REAL DEFAULT 0,
      total_wage REAL DEFAULT 0,
      utility_advance REAL DEFAULT 0,
      final_bulk_paid REAL DEFAULT 0,
      settlement_status TEXT DEFAULT 'Settled',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. Transport & Lorry Dispatch (Loading sheet)
    CREATE TABLE IF NOT EXISTS transport_dispatches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      lorry_no TEXT NOT NULL,
      broker_agency TEXT,
      route_from TEXT DEFAULT 'Thennalapatti',
      route_to TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      driver_wage REAL DEFAULT 0,
      vehicle_rent REAL DEFAULT 0,
      freight_amount REAL DEFAULT 0,
      advance_freight REAL DEFAULT 0,
      balance_freight REAL DEFAULT 0,
      cargo_weight_kg REAL DEFAULT 0,
      total_bags INTEGER DEFAULT 0,
      bag_details_json TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Manager Expenses (Petrol, Travel, Maintenance)
    CREATE TABLE IF NOT EXISTS manager_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      manager_name TEXT NOT NULL,
      vehicle_no TEXT,
      expense_type TEXT NOT NULL,
      voucher_no TEXT,
      amount REAL NOT NULL,
      debit_credit TEXT DEFAULT 'debit',
      meter_reading TEXT,
      payment_mode TEXT DEFAULT 'Cash',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 11. Manager Salaries
    CREATE TABLE IF NOT EXISTS manager_salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_name TEXT NOT NULL,
      month_year TEXT NOT NULL,
      monthly_salary REAL NOT NULL,
      advances_taken REAL DEFAULT 0,
      other_deductions REAL DEFAULT 0,
      net_salary_paid REAL NOT NULL,
      payment_date TEXT,
      payment_mode TEXT DEFAULT 'Bank Transfer',
      status TEXT DEFAULT 'Paid',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 12. Buyers (Export & Wholesale)
    CREATE TABLE IF NOT EXISTS buyers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      gstin TEXT,
      address TEXT,
      market_city TEXT,
      state_name TEXT,
      state_code TEXT DEFAULT '29',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Export Invoices (Tally Compliant)
    CREATE TABLE IF NOT EXISTS export_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,
      invoice_date TEXT NOT NULL,
      buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
      buyer_name TEXT NOT NULL,
      buyer_gstin TEXT,
      buyer_address TEXT,
      lorry_no TEXT,
      hsn_code TEXT DEFAULT '08011210',
      product_description TEXT DEFAULT 'Fresh Semi-Husked Coconuts (தேங்காய்)',
      bag_count INTEGER DEFAULT 0,
      total_weight_kg REAL DEFAULT 0,
      rate_per_kg REAL DEFAULT 0,
      taxable_value REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      is_interstate INTEGER DEFAULT 1,
      igst_rate REAL DEFAULT 5.0,
      igst_amount REAL DEFAULT 0,
      cgst_rate REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_rate REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      total_invoice_amount REAL DEFAULT 0,
      dd_receipt_date TEXT,
      dd_amount REAL DEFAULT 0,
      bank_name TEXT DEFAULT 'Canara Bank',
      balance_due REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'Paid',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 14. Cash & Bank Book (Double-entry / Debit & Credit journal)
    CREATE TABLE IF NOT EXISTS cash_book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      voucher_no TEXT,
      entry_type TEXT NOT NULL, -- 'credit' (வரவு / Income) or 'debit' (செலவு / பற்று / Payment)
      category TEXT NOT NULL,
      particulars TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT DEFAULT 'Cash',
      ref_id TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Database schema verified & initialized successfully.');
}

function seedHistoricalNotebookData() {
  const buyerCheck = db.prepare('SELECT COUNT(*) as count FROM buyers').get();
  if (buyerCheck.count > 0) {
    console.log('Database already contains records. Skipping seed.');
    return;
  }

  console.log('Seeding authentic historical records from 16 notebook pages...');

  // --- Seed Buyers (Page 12) ---
  const insertBuyer = db.prepare(`
    INSERT INTO buyers (trade_name, contact_person, phone, gstin, address, market_city, state_name, state_code, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const buyerRes = insertBuyer.run(
    'M/s Shree Renuka Traders',
    'Shree Renuka Management',
    '9743747349',
    '29BDDPG0800P1ZK',
    'CTS No. 841/2A, GP Market, Burud Galli, Raviwar Peth',
    'Belagavi',
    'Karnataka',
    '29',
    'Verified from Notebook Scan Page 12'
  );
  const buyerId = Number(buyerRes.lastInsertRowid);

  // --- Seed Export Invoices (Page 12) ---
  const insertInvoice = db.prepare(`
    INSERT INTO export_invoices (
      invoice_no, invoice_date, buyer_id, buyer_name, buyer_gstin, buyer_address,
      lorry_no, hsn_code, product_description, bag_count, total_weight_kg, rate_per_kg,
      taxable_value, discount_amount, is_interstate, igst_rate, igst_amount,
      total_invoice_amount, dd_receipt_date, dd_amount, bank_name, balance_due, payment_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const historicalInvoices = [
    { no: 'BILL-07', date: '2026-04-05', lorry: 'TN 28 AM 1498', bags: 107, kg: 6070, rate: 56.50, amt: 342955, dd_date: '2026-04-15', dd_amt: 342955, bank: 'Canara Bank', bal: 0, status: 'Paid' },
    { no: 'BILL-19', date: '2026-04-13', lorry: 'TN 88 E 8688', bags: 177, kg: 9650, rate: 56.50, amt: 545225, dd_date: '2026-04-25', dd_amt: 548615, bank: 'Canara Bank', bal: 0, status: 'Paid' },
    { no: 'BILL-25', date: '2026-04-22', lorry: 'TN 48 AH 6337', bags: 100, kg: 5500, rate: 56.00, amt: 308000, dd_date: null, dd_amt: 0, bank: 'Canara Bank', bal: 308000, status: 'Pending' },
    { no: 'BILL-42', date: '2026-05-02', lorry: 'TN 28 AJ 4286', bags: 100, kg: 5710, rate: 55.00, amt: 314050, dd_date: '2026-05-11', dd_amt: 314050, bank: 'Canara Bank', bal: 0, status: 'Paid' },
    { no: 'BILL-52', date: '2026-05-11', lorry: 'TN 28 C 4692', bags: 125, kg: 7020, rate: 51.00, amt: 358020, dd_date: '2026-05-25', dd_amt: 358020, bank: 'Canara Bank', bal: 0, status: 'Paid' },
    { no: 'BILL-122', date: '2026-07-07', lorry: 'TN 28 BB 8389', bags: 100, kg: 6010, rate: 48.50, amt: 291485, dd_date: '2026-07-20', dd_amt: 291485, bank: 'Canara Bank', bal: 0, status: 'Paid' },
    { no: 'BILL-148', date: '2026-08-08', lorry: 'TN 28 BB 8389', bags: 162, kg: 9185, rate: 61.50, amt: 564877, dd_date: '2026-08-27', dd_amt: 564877, bank: 'Canara Bank', bal: 0, status: 'Paid' },
    { no: 'BILL-179', date: '2026-08-19', lorry: 'TN 23 CV 2489', bags: 177, kg: 10290, rate: 61.50, amt: 549900, dd_date: '2026-09-03', dd_amt: 549900, bank: 'Canara Bank', bal: 0, status: 'Paid' },
    { no: 'BILL-189', date: '2026-08-26', lorry: 'TN 54 J 1757', bags: 250, kg: 2300, rate: 24.51, amt: 56376, dd_date: '2026-09-08', dd_amt: 56376, bank: 'Canara Bank', bal: 0, status: 'Paid' },
    { no: 'BILL-194', date: '2026-08-31', lorry: 'TN 28 AH 6239', bags: 150, kg: 8727, rate: 61.00, amt: 532347, dd_date: null, dd_amt: 0, bank: 'Canara Bank', bal: 532347, status: 'Pending' },
    { no: 'BILL-215', date: '2026-09-09', lorry: 'TN 34 H 2631', bags: 122, kg: 7280, rate: 61.00, amt: 376431, dd_date: null, dd_amt: 0, bank: 'Canara Bank', bal: 376431, status: 'Pending' },
  ];

  historicalInvoices.forEach(inv => {
    insertInvoice.run(
      inv.no, inv.date, buyerId, 'M/s Shree Renuka Traders', '29BDDPG0800P1ZK',
      'Belagavi, Karnataka', inv.lorry, '08011210', 'Fresh Semi-Husked Export Coconuts',
      inv.bags, inv.kg, inv.rate, inv.amt, 0, 1, 5.0, 0, inv.amt,
      inv.dd_date, inv.dd_amt, inv.bank, inv.bal, inv.status, 'Notebook Page 12'
    );
  });

  // --- Seed Transport / Lorry Dispatch (Page 2) ---
  const insertDispatch = db.prepare(`
    INSERT INTO transport_dispatches (
      date, lorry_no, broker_agency, route_from, route_to, driver_name, driver_phone,
      freight_amount, advance_freight, balance_freight, cargo_weight_kg, total_bags,
      bag_details_json, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const bagDetailsP2 = JSON.stringify([
    { bagGrade: '100 Bag', count: 100, rate: 41, amount: 4100 },
    { bagGrade: '125 Bag', count: 125, rate: 71, amount: 8875 },
    { bagGrade: '150 Bag', count: 150, rate: 73, amount: 10950 },
    { bagGrade: '175 Bag', count: 175, rate: 63, amount: 11025 },
    { bagGrade: '200 Bag', count: 200, rate: 38, amount: 7600 },
    { bagGrade: '225 Bag', count: 225, rate: 24, amount: 5400 },
  ]);

  insertDispatch.run(
    '2026-04-12', 'TN 38 AJ 4386', 'M/s SD Coimbatore Transport', 'Thennalapatti', 'Vadakara',
    'Driver', '9751399029', 49700, 3000, 46700, 17130, 970, bagDetailsP2, 'Notebook Page 2'
  );

  // --- Seed Farmers (Pages 13 & 14) ---
  const insertFarmer = db.prepare(`
    INSERT INTO farmers (name, phone, village, bank_name, account_no, ifsc_code, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const farmerRes = insertFarmer.run(
    'கணேசன் செட்டு (Ganesan Chettu)',
    '9842100000',
    'உரியூர் (Uriyur)',
    'State Bank of India',
    '30987654321',
    'SBIN0001234',
    'Lease Farm & Harvesting Team - Notebook Page 14'
  );
  const farmerId = Number(farmerRes.lastInsertRowid);

  // Harvest records from Page 14
  const insertProcurement = db.prepare(`
    INSERT INTO farmer_procurements (
      farmer_id, farmer_name, date, batch_no, coconut_type, quantity_count,
      unit_rate, gross_amount, advance_paid, net_payable, payment_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const p14Harvests = [
    { date: '2024-11-02', count: 6200, adv: 20000 },
    { date: '2024-11-03', count: 8500, adv: 1000 },
    { date: '2024-11-04', count: 1850, adv: 400 },
    { date: '2024-11-05', count: 3800, adv: 3700 },
    { date: '2024-11-06', count: 4500, adv: 3600 },
    { date: '2024-11-07', count: 4300, adv: 4500 },
    { date: '2024-11-08', count: 0, adv: 8000 },
    { date: '2024-11-09', count: 10970, adv: 3000 },
    { date: '2024-11-10', count: 11470, adv: 11600 },
    { date: '2024-11-11', count: 9730, adv: 3500 },
    { date: '2024-11-12', count: 9600, adv: 4000 },
    { date: '2024-11-13', count: 6460, adv: 10000 },
    { date: '2024-11-14', count: 13450, adv: 10000 },
    { date: '2024-11-15', count: 13410, adv: 0 },
    { date: '2024-11-16', count: 9360, adv: 10000 },
    { date: '2024-11-17', count: 10190, adv: 5000 },
    { date: '2024-11-18', count: 9850, adv: 8500 },
  ];

  p14Harvests.forEach((h, idx) => {
    const gross = h.count > 0 ? (h.count * 0.85) : 0;
    insertProcurement.run(
      farmerId, 'கணேசன் செட்டு (Ganesan Chettu)', h.date, `BATCH-2024-${String(idx+1).padStart(2, '0')}`,
      'உரியூர் தோட்டம் காய்', h.count, 0.85, gross, h.adv, gross - h.adv, 'Settled', 'Notebook Page 14'
    );
  });

  // --- Seed Husk Suppliers (Pages 6 & 7) ---
  const insertHuskSupplier = db.prepare(`
    INSERT INTO husk_suppliers (name, village, phone, notes)
    VALUES (?, ?, ?, ?)
  `);
  const huskSupRes = insertHuskSupplier.run(
    'திரு. பாலமுருகன் (Balamurugan)',
    'ராஜகம்பாளையம் / நாச்சிபாளையம்',
    '9443736795',
    'Ex MLA வடிவேல் கவுண்டம்பாளையம் - Notebook Pages 6 & 7'
  );
  const huskSupId = Number(huskSupRes.lastInsertRowid);

  const insertHuskPurchase = db.prepare(`
    INSERT INTO husk_purchases (
      supplier_id, supplier_name, date, vehicle_no, husk_category, trips, trip_rate,
      nut_count, nut_rate, total_amount, payment_mode, paid_amount, balance_amount, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertHuskPurchase.run(
    huskSupId, 'திரு. பாலமுருகன்', '2026-04-30', 'Eicher Lorry', 'KN & MO மட்டை (Husk)',
    16.75, 13500, 53310, 1.25, 292762, 'Canara Bank A/c', 292000, 762, 'Settled',
    '16 3/4 Trips (Rs. 2,26,125) + 53,310 nuts @ 1.25 (Rs. 66,637) = Rs. 2,92,762. Notebook Page 7'
  );

  // --- Seed Workers (Pages 4, 9, 10, 16) ---
  const insertWorker = db.prepare(`
    INSERT INTO workers (name, village, phone, worker_type, group_name, fixed_daily_wage, monthly_salary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const wMuthu = insertWorker.run('முத்து (Muthu)', 'வாழப்பந்தல்', '9876543210', 'individual_dehusker', null, 0, 0, 'De-husker - Notebook Page 16');
  const wSivapandi = insertWorker.run('திரு. சிவபாண்டி செட்டி', 'அய்யம்பாளையம்', '9443000000', 'group_dehusker', 'Sivapandi Loadman Team', 0, 0, 'Loadman Contractor - Notebook Page 4');
  const wSaravanan = insertWorker.run('சரவணன் (Saravanan)', 'வாழப்பந்தல்', null, 'carrier', null, 450, 0, 'Coconut Handler / Carrier - Page 9');
  const wChandran = insertWorker.run('சந்திரன் (Chandran)', 'அய்யம்பாளையம்', null, 'carrier', null, 450, 0, 'Coconut Handler / Carrier - Page 9');
  const wChinnaraj = insertWorker.run('சின்னராஜ் (Chinnaraj)', 'ராஜகம்பாளையம்', null, 'carrier', null, 450, 0, 'Coconut Handler / Carrier - Page 9');
  const wDeena = insertWorker.run('தீனா (Deena)', 'வாழப்பந்தல்', null, 'field_picker', null, 500, 0, 'Coconut Picker - Page 9');
  const wVadivel = insertWorker.run('டி. வடிவேல் (T. Vadivel)', 'நாச்சிபாளையம்', null, 'driver', null, 600, 0, 'Lorry Driver - Page 9, 10');
  const wManager = insertWorker.run('சுரேஷ் மேலாளர் (Suresh Manager)', 'ஆர்த்தக்கடை', '9751000000', 'manager', null, 0, 25000, 'Operations Manager');

  // De-husking records for Muthu (Page 16)
  const insertDehusking = db.prepare(`
    INSERT INTO dehusking_records (
      worker_id, worker_name, date, work_type, count_4p, rate_4p, count_mo, rate_mo,
      count_pl, rate_pl, gross_wage, utility_advance, net_balance, settlement_status, settled_date, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const dehuskingEntries = [
    { date: '2025-11-28', c4p: 1850, cmo: 0, cpl: 350, adv: 330, gross: (1850*0.90 + 350*1.0) },
    { date: '2025-11-29', c4p: 2170, cmo: 0, cpl: 0, adv: 2030, gross: (2170*0.90) },
    { date: '2025-11-30', c4p: 2350, cmo: 0, cpl: 0, adv: 1030, gross: (2350*0.90) },
    { date: '2025-12-01', c4p: 2460, cmo: 0, cpl: 0, adv: 330, gross: (2460*0.90) },
    { date: '2025-12-02', c4p: 1650, cmo: 0, cpl: 0, adv: 330, gross: (1650*0.90) },
    { date: '2025-12-03', c4p: 1860, cmo: 0, cpl: 0, adv: 430, gross: (1860*0.90) },
    { date: '2025-12-04', c4p: 2470, cmo: 0, cpl: 0, adv: 330, gross: (2470*0.90) },
    { date: '2025-12-05', c4p: 2550, cmo: 0, cpl: 0, adv: 430, gross: (2550*0.90) },
    { date: '2025-12-06', c4p: 1700, cmo: 0, cpl: 0, adv: 330, gross: (1700*0.90) },
    { date: '2025-12-07', c4p: 0, cmo: 0, cpl: 0, adv: 500, gross: 0 },
    { date: '2025-12-08', c4p: 0, cmo: 0, cpl: 0, adv: 10000, gross: 0 },
    { date: '2025-12-09', c4p: 0, cmo: 2400, cpl: 0, adv: 230, gross: (2400*0.70) },
    { date: '2025-12-10', c4p: 0, cmo: 1050, cpl: 0, adv: 230, gross: (1050*0.70) },
    { date: '2025-12-11', c4p: 1900, cmo: 0, cpl: 0, adv: 230, gross: (1900*0.90) },
    { date: '2025-12-12', c4p: 2500, cmo: 0, cpl: 0, adv: 430, gross: (2500*0.90) },
    { date: '2025-12-14', c4p: 2210, cmo: 0, cpl: 0, adv: 230, gross: (2210*0.90) },
    { date: '2025-12-15', c4p: 2430, cmo: 0, cpl: 0, adv: 230, gross: (2430*0.90) },
    { date: '2025-12-16', c4p: 2000, cmo: 0, cpl: 0, adv: 430, gross: (2000*0.90) },
    { date: '2025-12-17', c4p: 2500, cmo: 0, cpl: 0, adv: 330, gross: (2500*0.90) },
    { date: '2025-12-18', c4p: 890, cmo: 0, cpl: 0, adv: 330, gross: (890*0.90) },
    { date: '2025-12-19', c4p: 2010, cmo: 0, cpl: 0, adv: 330, gross: (2010*0.90) },
    { date: '2025-12-20', c4p: 1820, cmo: 0, cpl: 0, adv: 330, gross: (1820*0.90) },
    { date: '2025-12-21', c4p: 2450, cmo: 0, cpl: 0, adv: 430, gross: (2450*0.90) },
    { date: '2025-12-22', c4p: 2500, cmo: 0, cpl: 0, adv: 930, gross: (2500*0.90) },
  ];

  dehuskingEntries.forEach(e => {
    insertDehusking.run(
      Number(wMuthu.lastInsertRowid), 'முத்து (Muthu)', e.date, 'individual',
      e.c4p, 0.90, e.cmo, 0.70, e.cpl, 1.00, e.gross, e.adv, e.gross - e.adv,
      'settled_bulk', e.date, 'Notebook Page 16'
    );
  });

  // Seed Carriers Fixed Wages (Page 9)
  const insertCarrierWage = db.prepare(`
    INSERT INTO carrier_wages (worker_id, worker_name, role, date, attendance, daily_fixed_rate, utility_advance, net_payable, payment_status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCarrierWage.run(Number(wSaravanan.lastInsertRowid), 'சரவணன் (Saravanan)', 'carrier', '2026-04-14', 'present', 450, 430, 20, 'Paid', 'Notebook Page 9');
  insertCarrierWage.run(Number(wChandran.lastInsertRowid), 'சந்திரன் (Chandran)', 'carrier', '2026-04-14', 'present', 450, 230, 220, 'Paid', 'Notebook Page 9');
  insertCarrierWage.run(Number(wChinnaraj.lastInsertRowid), 'சின்னராஜ் (Chinnaraj)', 'carrier', '2026-04-14', 'present', 450, 500, 0, 'Paid', 'Notebook Page 9');
  insertCarrierWage.run(Number(wDeena.lastInsertRowid), 'தீனா (Deena)', 'field_picker', '2026-04-14', 'present', 500, 210, 290, 'Paid', 'Notebook Page 9');
  insertCarrierWage.run(Number(wVadivel.lastInsertRowid), 'டி. வடிவேல் (T. Vadivel)', 'driver', '2026-04-14', 'present', 600, 200, 400, 'Paid', 'Notebook Page 9');

  // --- Seed Loadman Records (Page 4) ---
  const insertLoadman = db.prepare(`
    INSERT INTO loadman_records (contractor_name, date, lorry_no, load_details, batta, coolie, advance_paid, balance, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const p4Loadman = [
    { date: '2025-10-20', lorry: '', details: 'முன்பணம் ஆரம்பம்', batta: 0, coolie: 0, adv: 50000 },
    { date: '2025-10-22', lorry: '', details: 'A/c பற்று', batta: 0, coolie: 0, adv: 3000 },
    { date: '2025-10-23', lorry: '', details: 'படி வழங்கப்பட்டது', batta: 5, coolie: 0, adv: 1000 },
    { date: '2025-10-26', lorry: 'TN 98 8645', details: 'KN-84x58', batta: 8, coolie: 4872, adv: 2000 },
    { date: '2025-10-26', lorry: 'TN 98 8645 (v)', details: 'KN-166x57', batta: 0, coolie: 9462, adv: 0 },
    { date: '2025-10-27', lorry: '', details: 'வங்கி பற்று', batta: 9, coolie: 0, adv: 8000 },
    { date: '2025-10-28', lorry: 'TN 28 AH 1843', details: '4P loose-63x41', batta: 9, coolie: 2583, adv: 0 },
    { date: '2025-10-28', lorry: 'TN 28 P 6266', details: 'KN (loose 2wd)', batta: 0, coolie: 4600, adv: 0 },
    { date: '2025-10-30', lorry: 'TN 28 BC 7659', details: '4P 270x41', batta: 10, coolie: 11070, adv: 4000 },
    { date: '2025-11-01', lorry: 'TN 88 A 4267', details: 'KN 250x57', batta: 10, coolie: 14250, adv: 0 },
    { date: '2025-11-02', lorry: 'TN 88 A 6541', details: '4P loose 2wd', batta: 10, coolie: 4300, adv: 6000 },
    { date: '2025-11-05', lorry: 'TN 28 BC 9577', details: 'KN-207x58 + 43x57', batta: 8, coolie: 14457, adv: 2000 },
    { date: '2025-11-08', lorry: 'TN 45 BF 6580', details: 'KN-191x58', batta: 8, coolie: 11078, adv: 15000 },
    { date: '2025-11-16', lorry: 'TN 30 AH 7800', details: 'KN 280x38', batta: 7, coolie: 10640, adv: 8000 },
    { date: '2025-11-19', lorry: 'TN 23 CV 2489', details: 'KN 36x27 + 145x26', batta: 7, coolie: 4814, adv: 5000 },
    { date: '2025-11-20', lorry: '', details: 'கணக்கு முடிவு பற்று', batta: 7, coolie: 0, adv: 35000 }
  ];

  p4Loadman.forEach(l => {
    insertLoadman.run(
      'திரு. சிவபாண்டி செட்டி - அய்யம்பாளையம்', l.date, l.lorry, l.details,
      l.batta, l.coolie, l.adv, l.coolie - l.adv, 'Notebook Page 4'
    );
  });

  // --- Seed Cash Book (Pages 9 & 10) ---
  const insertCash = db.prepare(`
    INSERT INTO cash_book (date, voucher_no, entry_type, category, particulars, amount, payment_mode, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const cashRecords = [
    { date: '2026-04-14', v: 'V-001', type: 'debit', cat: 'Petrol & Fuel', part: 'Pulsar Petrol செலவு (Manager Bike)', amt: 500, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-002', type: 'debit', cat: 'Office & Utilities', part: 'சிமெண்ட் தூண் 2 வாங்கியது (Cement Pillars for yard)', amt: 600, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-003', type: 'debit', cat: 'Packaging Materials', part: 'ஆந்திரா நெட்டுக்கு பாத்திரம் வாங்கியது (Net packing vessels)', amt: 950, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-004', type: 'debit', cat: 'Vehicle Rent', part: 'கணேசன் நெட்டுக்கு லாரி செலவு', amt: 290, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-005', type: 'credit', cat: 'Customer Receipt', part: 'Nathan TN 88 A 4979 er வரவு', amt: 30000, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-006', type: 'debit', cat: 'Carrier Wages', part: 'சரவணன் தினசரி முன்பணம்', amt: 430, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-007', type: 'debit', cat: 'Carrier Wages', part: 'முத்து தினசரி முன்பணம்', amt: 130, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-008', type: 'debit', cat: 'Carrier Wages', part: 'சந்திரன் தினசரி முன்பணம்', amt: 230, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-009', type: 'debit', cat: 'Carrier Wages', part: 'சின்னராஜ் தினசரி முன்பணம்', amt: 500, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-010', type: 'debit', cat: 'Carrier Wages', part: 'தீனா தினசரி முன்பணம்', amt: 210, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-011', type: 'debit', cat: 'Packaging Materials', part: 'ஆந்திரா பங்கிங் பேக்கிங் செலவு', amt: 6000, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-012', type: 'debit', cat: 'Harvesting Coolie', part: '11,670 காய் எடுத்த அறுவடை கூலி', amt: 2050, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-013', type: 'debit', cat: 'Loading Coolie', part: 'சிவபாண்டி செட்டி லோடு முன்பணம்', amt: 13000, mode: 'Cash' },
    { date: '2026-04-14', v: 'V-014', type: 'credit', cat: 'Bank Transfer', part: 'பேங்க் Cash வரவு (Withdrawal from Canara Bank)', amt: 50000, mode: 'Canara Bank' },
    { date: '2026-04-22', v: 'V-015', type: 'credit', cat: 'Customer Receipt', part: '22 SBI Online வரவு - Ajith kumar A/c', amt: 400000, mode: 'SBI Online' },
    { date: '2026-04-22', v: 'V-016', type: 'debit', cat: 'Harvesting Coolie', part: 'டிராக்டரில் 14,560 காய் எடுத்த கூலி', amt: 2550, mode: 'Cash' },
    { date: '2026-04-22', v: 'V-017', type: 'debit', cat: 'Packaging Materials', part: 'பருப்பு அள்ளி அடுக்கின சாப்பாடு + பெட்ரோல் செலவு', amt: 3300, mode: 'Cash' },
    { date: '2026-04-22', v: 'V-018', type: 'debit', cat: 'Petrol & Fuel', part: 'டீசல் செலவு (Diesel for truck & generator)', amt: 280, mode: 'Cash' },
    { date: '2026-04-22', v: 'V-019', type: 'debit', cat: 'Electricity Bill', part: 'மின்சார வாரியம் (EB Power bill for dehusking shed)', amt: 4200, mode: 'Canara Bank' },
    { date: '2026-04-22', v: 'V-020', type: 'debit', cat: 'Auditing Fees', part: 'ஆடிட்டர் கட்டணம் (GST & Annual Audit bill)', amt: 7500, mode: 'Canara Bank' },
  ];

  cashRecords.forEach(c => {
    insertCash.run(c.date, c.v, c.type, c.cat, c.part, c.amt, c.mode, 'Notebook Pages 9 & 10');
  });

  // --- Seed Manager Fuel Expenses ---
  const insertMgrExp = db.prepare(`
    INSERT INTO manager_expenses (date, manager_name, vehicle_no, expense_type, voucher_no, amount, debit_credit, meter_reading, payment_mode, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMgrExp.run('2026-04-14', 'சுரேஷ் மேலாளர் (Suresh)', 'TN 88 AK 9911', 'petrol', 'PET-101', 500, 'debit', '45,210 km', 'Cash', 'Field grove visit petrol voucher');
  insertMgrExp.run('2026-04-22', 'சுரேஷ் மேலாளர் (Suresh)', 'TN 88 AK 9911', 'diesel', 'DSL-102', 280, 'debit', '45,630 km', 'Cash', 'Lorry coordination trip');

  // --- Seed Manager Salaries ---
  const insertMgrSal = db.prepare(`
    INSERT INTO manager_salaries (manager_name, month_year, monthly_salary, advances_taken, other_deductions, net_salary_paid, payment_date, payment_mode, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMgrSal.run('சுரேஷ் மேலாளர் (Suresh)', '2026-04', 25000, 2000, 0, 23000, '2026-04-30', 'Bank Transfer', 'Paid', 'April 2026 manager salary');

  // --- Seed Group Grading ---
  const insertGrading = db.prepare(`
    INSERT INTO group_gradings (date, vehicle_no, group_name, gunny_bag_variant, bag_count, piece_count_per_bag, total_pieces, rate_per_bag, total_wage, utility_advance, final_bulk_paid, settlement_status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertGrading.run('2026-04-12', 'TN 38 AJ 4386', 'Vadakara Grading Team', 'Grade A - 41 Count Bag', 100, 41, 4100, 8.0, 800, 200, 600, 'Settled', 'Grading for M/s SD consignment');
  insertGrading.run('2026-04-12', 'TN 38 AJ 4386', 'Vadakara Grading Team', 'Grade B - 71 Count Bag', 125, 71, 8875, 10.0, 1250, 300, 950, 'Settled', 'Consignment grading Page 2');

  console.log('All historical records successfully seeded into SQLite database!');
}

initSchema();
seedHistoricalNotebookData();

module.exports = {
  db,
  initSchema
};
