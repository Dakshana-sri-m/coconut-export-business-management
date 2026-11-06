// public/app.js - Modern Interactive Engine for Coconut Export Management

let currentView = 'dashboard';
let cachedData = {};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initLucide();
  setupNavigation();
  loadAllData();
  setDefaultDates();

  // Search listeners
  setupSearch('searchInvoices', 'invoicesTableBody');
  setupSearch('searchProcurements', 'procurementsTableBody');
  setupSearch('searchDehusking', 'dehuskingTableBody');

  // Quick Add handler
  document.getElementById('btnQuickAdd').addEventListener('click', () => {
    if (currentView === 'invoices') openInvoiceModal();
    else if (currentView === 'farmers') openProcurementModal();
    else if (currentView === 'dehusking') openDehuskingModal();
    else if (currentView === 'husk') openHuskModal();
    else if (currentView === 'managers') openManagerExpenseModal();
    else openCashBookModal();
  });
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => {
    if (!input.value) input.value = today;
  });
}

// Navigation between views
function setupNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      navigateTo(view);
    });
  });
}

function navigateTo(view) {
  currentView = view;
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-view') === view);
  });

  document.querySelectorAll('.page-view').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSec = document.getElementById(`view-${view}`);
  if (targetSec) {
    targetSec.classList.add('active');
  }

  // Update header titles
  const titles = {
    dashboard: { title: 'Business Overview & Dashboard', sub: 'Real-time financial indicators and operations tracking' },
    invoices: { title: 'Export Invoices & Tally Integration', sub: 'B2B GST invoices, Demand Drafts, and TallyPrime XML export' },
    farmers: { title: 'Farmers & Coconut Incoming', sub: 'Grove harvest batches, plucking coolie deductions & payments' },
    dehusking: { title: 'Coconut De-husking Labor', sub: 'Piece-rate variant wage calculations (4P, MO, PL) & bulk settlements' },
    grading: { title: 'Group Grading by Gunny Bag', sub: 'Vehicle loading assortment and grading group wages' },
    carriers: { title: 'Carriers, Handlers & Drivers', sub: 'Fixed daily wage staff attendance and wage disbursement' },
    dispatch: { title: 'Lorry Dispatch & Consignments', sub: 'Loading sheets, freight charges, driver contacts & weight slips' },
    husk: { title: 'Coconut Husk (Mattai) Purchases', sub: 'Estate husk loads, trip rates & supplier bank installments' },
    managers: { title: 'Manager Fleet, Petrol & Salaries', sub: 'Field manager fuel debit vouchers, vehicle rent & payroll' },
    cashbook: { title: 'Cash & Bank Book Journal', sub: 'Double-entry operational income and expense tracking' },
    notebook: { title: 'Physical Notebook Records Archive', sub: '16 pages of scanned handwritten records and verified digital schemas' }
  };

  if (titles[view]) {
    document.getElementById('currentViewTitle').innerText = titles[view].title;
    document.getElementById('currentViewSub').innerText = titles[view].sub;
  }

  initLucide();
}

// -------------------------------------------------------------
// DATA LOADING
// -------------------------------------------------------------
async function loadAllData() {
  await Promise.all([
    loadSummary(),
    loadInvoices(),
    loadProcurements(),
    loadDehusking(),
    loadCarriers(),
    loadGrading(),
    loadDispatch(),
    loadHusk(),
    loadManagerExpenses(),
    loadManagerSalaries(),
    loadCashBook(),
    loadNotebookArchive()
  ]);
  initLucide();
}

async function loadSummary() {
  try {
    const res = await fetch('/api/summary');
    const data = await res.json();
    cachedData.summary = data;

    // KPI Cards
    document.getElementById('kpiTotalSales').innerText = formatCurrency(data.sales.totalSales);
    document.getElementById('kpiReceivable').innerText = formatCurrency(data.sales.totalReceivable);
    document.getElementById('kpiCashInHand').innerText = formatCurrency(data.cashBook.cashInHand);
    document.getElementById('kpiTotalNuts').innerText = `${Number(data.harvest.totalNuts).toLocaleString()} nuts`;

    // Labor Wage Overview
    document.getElementById('dashTotalDehusked').innerText = `${Number(data.dehusking.totalDehusked).toLocaleString()} nuts`;
    document.getElementById('dashTotalWageEarned').innerText = formatCurrency(data.dehusking.totalWageEarned);
    document.getElementById('dashTotalUtilityAdv').innerText = formatCurrency(data.dehusking.totalUtilityAdvances);
    document.getElementById('dashPendingBulkPay').innerText = formatCurrency(data.dehusking.totalPendingBulkPay);

    // Recent Invoices Table on Dashboard
    const invTbody = document.getElementById('dashboardInvoicesTbody');
    if (data.recentInvoices && data.recentInvoices.length > 0) {
      invTbody.innerHTML = data.recentInvoices.map(inv => `
        <tr>
          <td><strong>${inv.invoice_no}</strong></td>
          <td>${inv.invoice_date}</td>
          <td>${inv.buyer_name}</td>
          <td><span class="badge badge-gray">${inv.lorry_no || 'TN 28'}</span></td>
          <td>${Number(inv.total_weight_kg).toLocaleString()} kg</td>
          <td><strong>${formatCurrency(inv.total_invoice_amount)}</strong></td>
          <td><span class="badge ${inv.payment_status === 'Paid' ? 'badge-success' : 'badge-warning'}">${inv.payment_status}</span></td>
        </tr>
      `).join('');
    } else {
      invTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No export invoices recorded yet.</td></tr>';
    }

    // Recent Cash Table on Dashboard
    const cashTbody = document.getElementById('dashboardCashTbody');
    if (data.recentCash && data.recentCash.length > 0) {
      cashTbody.innerHTML = data.recentCash.map(c => `
        <tr>
          <td>${c.date}</td>
          <td>${c.particulars}</td>
          <td><span class="badge ${c.entry_type === 'credit' ? 'badge-success' : 'badge-danger'}">${c.entry_type === 'credit' ? 'வரவு (Credit)' : 'செலவு (Debit)'}</span></td>
          <td style="font-weight:700; color:${c.entry_type === 'credit' ? '#16a34a' : '#dc2626'};">${c.entry_type === 'credit' ? '+' : '-'} ${formatCurrency(c.amount)}</td>
        </tr>
      `).join('');
    } else {
      cashTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No cash book entries yet.</td></tr>';
    }

  } catch (err) {
    console.error('Error loading summary:', err);
  }
}

// --- 1. EXPORT INVOICES ---
async function loadInvoices() {
  try {
    const res = await fetch('/api/invoices');
    const invoices = await res.json();
    cachedData.invoices = invoices;

    document.getElementById('badgeInvoiceCount').innerText = invoices.length;
    const tbody = document.getElementById('invoicesTableBody');
    if (invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:20px;">No invoices found. Click + New Export Invoice to create one.</td></tr>';
      return;
    }

    tbody.innerHTML = invoices.map(inv => `
      <tr>
        <td><strong>${inv.invoice_no}</strong></td>
        <td>${inv.invoice_date}</td>
        <td>
          <div><strong>${inv.buyer_name}</strong></div>
          <div style="font-size:11px; color:var(--slate-500);">${inv.buyer_address || ''}</div>
        </td>
        <td><span class="badge badge-gray">${inv.lorry_no || '-'}</span></td>
        <td>${inv.bag_count || 0}</td>
        <td>${Number(inv.total_weight_kg || 0).toLocaleString()} kg</td>
        <td>₹${Number(inv.rate_per_kg || 0).toFixed(2)}</td>
        <td><strong style="color:var(--primary-800);">${formatCurrency(inv.total_invoice_amount)}</strong></td>
        <td>${inv.dd_receipt_date || '-'}</td>
        <td>${inv.dd_amount ? formatCurrency(inv.dd_amount) : '-'}</td>
        <td><strong style="color:${inv.balance_due > 0 ? '#ea580c' : '#16a34a'};">${formatCurrency(inv.balance_due)}</strong></td>
        <td><span class="badge ${inv.payment_status === 'Paid' ? 'badge-success' : (inv.payment_status === 'Partial' ? 'badge-warning' : 'badge-danger')}">${inv.payment_status}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" title="Download TallyPrime XML" onclick="downloadTallyXml(${inv.id})">
              <i data-lucide="file-code" style="width:14px;height:14px;"></i> Tally
            </button>
            <button class="btn btn-secondary btn-sm" title="Print GST Invoice" onclick="printInvoice(${inv.id})">
              <i data-lucide="printer" style="width:14px;height:14px;"></i> Print
            </button>
            <button class="btn btn-outline-danger btn-sm" title="Delete" onclick="deleteRecord('/api/invoices/' + ${inv.id}, loadInvoices)">
              <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
    initLucide();
  } catch (err) {
    console.error('Error loading invoices:', err);
  }
}

// --- 2. FARMER PROCUREMENTS ---
async function loadProcurements() {
  try {
    const res = await fetch('/api/procurements');
    const records = await res.json();
    cachedData.procurements = records;

    const tbody = document.getElementById('procurementsTableBody');
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:20px;">No incoming records yet. Click + Incoming Coconut Batch.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(p => `
      <tr>
        <td><strong>${p.batch_no || '-'}</strong></td>
        <td>${p.date}</td>
        <td>
          <strong>${p.farmer_name}</strong>
          ${p.phone ? `<div style="font-size:11px; color:var(--slate-500);">📞 ${p.phone}</div>` : ''}
        </td>
        <td>${p.village || '-'}</td>
        <td><strong>${Number(p.quantity_count || 0).toLocaleString()} nuts</strong></td>
        <td>₹${Number(p.unit_rate || 0).toFixed(2)}</td>
        <td>${formatCurrency(p.gross_amount)}</td>
        <td>₹${Number(p.plucking_coolie || 0).toLocaleString()}</td>
        <td>₹${Number(p.advance_paid || 0).toLocaleString()}</td>
        <td><strong style="color:var(--primary-800);">${formatCurrency(p.net_payable)}</strong></td>
        <td><span class="badge ${p.payment_status === 'Settled' ? 'badge-success' : 'badge-warning'}">${p.payment_status}</span></td>
        <td>
          <button class="btn btn-outline-danger btn-sm" onclick="deleteRecord('/api/procurements/' + ${p.id}, loadProcurements)">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        </td>
      </tr>
    `).join('');
    initLucide();
  } catch (err) {
    console.error('Error loading procurements:', err);
  }
}

// --- 3. DE-HUSKING LABOR ---
async function loadDehusking() {
  try {
    const res = await fetch('/api/dehusking');
    const records = await res.json();
    cachedData.dehusking = records;

    const tbody = document.getElementById('dehuskingTableBody');
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px;">No de-husking records found.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(d => `
      <tr>
        <td>${d.date}</td>
        <td><strong>${d.worker_name}</strong></td>
        <td><span class="badge badge-gray">${d.work_type === 'individual' ? 'தனிநபர்' : 'குழு (செட்டு)'}</span></td>
        <td><span class="badge tag-4p">${Number(d.count_4p || 0).toLocaleString()}</span></td>
        <td><span class="badge tag-mo">${Number(d.count_mo || 0).toLocaleString()}</span></td>
        <td><span class="badge tag-pl">${Number(d.count_pl || 0).toLocaleString()}</span></td>
        <td><strong>${formatCurrency(d.gross_wage)}</strong></td>
        <td>${formatCurrency(d.utility_advance)}</td>
        <td><strong style="color:var(--gold-700);">${formatCurrency(d.net_balance)}</strong></td>
        <td>
          ${d.settlement_status === 'settled_bulk' 
            ? `<span class="badge badge-success">Bulk Settled (${d.settled_date || 'Yes'})</span>`
            : `<button class="btn btn-gold btn-sm" onclick="settleDehuskingBulk(${d.id})">Settle Home Departure</button>`
          }
        </td>
        <td>
          <button class="btn btn-outline-danger btn-sm" onclick="deleteRecord('/api/dehusking/' + ${d.id}, loadDehusking)">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        </td>
      </tr>
    `).join('');
    initLucide();
  } catch (err) {
    console.error('Error loading dehusking:', err);
  }
}

// --- 4. CARRIERS & DRIVERS ---
async function loadCarriers() {
  try {
    const res = await fetch('/api/carrier-wages');
    const records = await res.json();
    cachedData.carriers = records;

    const tbody = document.getElementById('carriersTableBody');
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">No carrier wage entries yet.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(c => `
      <tr>
        <td>${c.date}</td>
        <td><strong>${c.worker_name}</strong></td>
        <td><span class="badge badge-blue">${c.role}</span></td>
        <td><span class="badge badge-success">${c.attendance}</span></td>
        <td>₹${Number(c.daily_fixed_rate).toLocaleString()}</td>
        <td>₹${Number(c.utility_advance).toLocaleString()}</td>
        <td><strong>${formatCurrency(c.net_payable)}</strong></td>
        <td><span class="badge badge-success">${c.payment_status}</span></td>
        <td>
          <button class="btn btn-outline-danger btn-sm" onclick="deleteRecord('/api/carrier-wages/' + ${c.id}, loadCarriers)">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        </td>
      </tr>
    `).join('');
    initLucide();
  } catch (err) {
    console.error('Error loading carriers:', err);
  }
}

// --- 5. GROUP GRADING ---
async function loadGrading() {
  try {
    const res = await fetch('/api/group-grading');
    const records = await res.json();
    cachedData.grading = records;

    const tbody = document.getElementById('gradingTableBody');
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:20px;">No group grading entries yet.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(g => `
      <tr>
        <td>${g.date}</td>
        <td><span class="badge badge-gray">${g.vehicle_no || '-'}</span></td>
        <td><strong>${g.group_name}</strong></td>
        <td><span class="badge badge-gold">${g.gunny_bag_variant}</span></td>
        <td><strong>${g.bag_count} bags</strong></td>
        <td>${g.piece_count_per_bag} pcs</td>
        <td>${Number(g.total_pieces).toLocaleString()}</td>
        <td>₹${g.rate_per_bag}</td>
        <td>${formatCurrency(g.total_wage)}</td>
        <td>${formatCurrency(g.utility_advance)}</td>
        <td><strong>${formatCurrency(g.final_bulk_paid)}</strong></td>
        <td>
          <button class="btn btn-outline-danger btn-sm" onclick="deleteRecord('/api/group-grading/' + ${g.id}, loadGrading)">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        </td>
      </tr>
    `).join('');
    initLucide();
  } catch (err) {
    console.error('Error loading grading:', err);
  }
}

// --- 6. TRANSPORT & LORRY DISPATCH ---
async function loadDispatch() {
  try {
    const res = await fetch('/api/dispatch');
    const records = await res.json();
    cachedData.dispatch = records;

    const tbody = document.getElementById('dispatchTableBody');
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px;">No transport records yet.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(d => `
      <tr>
        <td>${d.date}</td>
        <td><strong>${d.lorry_no}</strong></td>
        <td>${d.broker_agency || '-'}</td>
        <td>${d.route_from} ➔ ${d.route_to}</td>
        <td><strong>${d.total_bags} bags</strong></td>
        <td>${Number(d.cargo_weight_kg || 0).toLocaleString()} kg</td>
        <td><strong>${formatCurrency(d.freight_amount)}</strong></td>
        <td>${formatCurrency(d.advance_freight)}</td>
        <td><strong style="color:var(--danger-600);">${formatCurrency(d.balance_freight)}</strong></td>
        <td>${d.driver_phone ? `📞 ${d.driver_phone}` : '-'}</td>
        <td>
          <button class="btn btn-outline-danger btn-sm" onclick="deleteRecord('/api/dispatch/' + ${d.id}, loadDispatch)">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        </td>
      </tr>
    `).join('');
    initLucide();
  } catch (err) {
    console.error('Error loading dispatch:', err);
  }
}

// --- 7. COCONUT HUSK PURCHASES ---
async function loadHusk() {
  try {
    const res = await fetch('/api/husk');
    const records = await res.json();
    cachedData.husk = records;

    const tbody = document.getElementById('huskTableBody');
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:20px;">No husk purchases logged yet.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(h => `
      <tr>
        <td>${h.date}</td>
        <td><strong>${h.supplier_name}</strong></td>
        <td><span class="badge badge-gray">${h.vehicle_no}</span></td>
        <td><span class="badge tag-kn">${h.husk_category}</span></td>
        <td><strong>${h.trips} நடை</strong></td>
        <td>₹${Number(h.trip_rate).toLocaleString()}</td>
        <td>${h.nut_count > 0 ? `${h.nut_count} nuts @ ₹${h.nut_rate}` : '-'}</td>
        <td><strong>${formatCurrency(h.total_amount)}</strong></td>
        <td>${formatCurrency(h.paid_amount)}</td>
        <td><strong style="color:${h.balance_amount > 0 ? '#ea580c' : '#16a34a'};">${formatCurrency(h.balance_amount)}</strong></td>
        <td><span class="badge badge-success">${h.status}</span></td>
        <td>
          <button class="btn btn-outline-danger btn-sm" onclick="deleteRecord('/api/husk/' + ${h.id}, loadHusk)">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        </td>
      </tr>
    `).join('');
    initLucide();
  } catch (err) {
    console.error('Error loading husk:', err);
  }
}

// --- 8. MANAGER EXPENSES & SALARIES ---
async function loadManagerExpenses() {
  try {
    const res = await fetch('/api/manager-expenses');
    const records = await res.json();
    cachedData.managerExpenses = records;

    const tbody = document.getElementById('managerExpTableBody');
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px;">No manager fuel vouchers yet.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(m => `
      <tr>
        <td>${m.date}</td>
        <td><strong>${m.voucher_no || '-'}</strong></td>
        <td>${m.manager_name}</td>
        <td><span class="badge badge-gray">${m.vehicle_no || '-'}</span></td>
        <td><span class="badge badge-gold">${m.expense_type.toUpperCase()}</span></td>
        <td>${m.meter_reading || '-'}</td>
        <td><strong style="color:var(--danger-600);">${formatCurrency(m.amount)}</strong></td>
        <td>${m.payment_mode}</td>
        <td><span class="badge badge-danger">Debit (செலவு)</span></td>
        <td>
          <button class="btn btn-outline-danger btn-sm" onclick="deleteRecord('/api/manager-expenses/' + ${m.id}, loadManagerExpenses)">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        </td>
      </tr>
    `).join('');
    initLucide();
  } catch (err) {
    console.error('Error loading manager expenses:', err);
  }
}

async function loadManagerSalaries() {
  try {
    const res = await fetch('/api/manager-salaries');
    const records = await res.json();
    cachedData.managerSalaries = records;

    const tbody = document.getElementById('managerSalTableBody');
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">No salary records yet.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(s => `
      <tr>
        <td><strong>${s.month_year}</strong></td>
        <td>${s.manager_name}</td>
        <td>${formatCurrency(s.monthly_salary)}</td>
        <td>${formatCurrency(s.advances_taken)}</td>
        <td>${formatCurrency(s.other_deductions)}</td>
        <td><strong style="color:var(--primary-800);">${formatCurrency(s.net_salary_paid)}</strong></td>
        <td>${s.payment_date || '-'}</td>
        <td><span class="badge badge-success">${s.status}</span></td>
      </tr>
    `).join('');
    initLucide();
  } catch (err) {
    console.error('Error loading manager salaries:', err);
  }
}

// --- 9. CASH & BANK BOOK ---
async function loadCashBook() {
  try {
    const res = await fetch('/api/cash-book');
    const records = await res.json();
    cachedData.cashBook = records;
    renderCashBook(records);
  } catch (err) {
    console.error('Error loading cash book:', err);
  }
}

function renderCashBook(records) {
  const tbody = document.getElementById('cashBookTableBody');
  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">No cash book records found.</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(c => `
    <tr>
      <td>${c.date}</td>
      <td><strong>${c.voucher_no || '-'}</strong></td>
      <td><span class="badge badge-gray">${c.category}</span></td>
      <td>${c.particulars}</td>
      <td style="color:#16a34a; font-weight:700;">${c.entry_type === 'credit' ? formatCurrency(c.amount) : '-'}</td>
      <td style="color:#dc2626; font-weight:700;">${c.entry_type === 'debit' ? formatCurrency(c.amount) : '-'}</td>
      <td><span class="badge badge-blue">${c.payment_mode}</span></td>
      <td>
        <button class="btn btn-outline-danger btn-sm" onclick="deleteRecord('/api/cash-book/' + ${c.id}, loadCashBook)">
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
        </button>
      </td>
    </tr>
  `).join('');
  initLucide();
}

function filterCashBook() {
  const cat = document.getElementById('filterCashCategory').value;
  if (!cachedData.cashBook) return;
  if (!cat) {
    renderCashBook(cachedData.cashBook);
  } else {
    const filtered = cachedData.cashBook.filter(c => c.category === cat);
    renderCashBook(filtered);
  }
}

// --- 10. NOTEBOOK SCANS ARCHIVE ---
async function loadNotebookArchive() {
  try {
    const res = await fetch('/api/notebook-archive');
    const archive = await res.json();
    cachedData.archive = archive;

    const grid = document.getElementById('notebookScanGrid');
    grid.innerHTML = archive.map(item => `
      <div class="scan-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="scan-badge">Page ${item.pageNumber} • ${item.type}</span>
          <span class="badge badge-gold">${item.digitalModule}</span>
        </div>
        <h4>${item.tamilTitle}</h4>
        <div style="font-size:12px; color:var(--primary-700); font-weight:600;">${item.englishTitle}</div>
        <p>${item.description}</p>
        <div class="scan-meta">
          <strong>Period / Reference:</strong> ${item.period}<br>
          ${item.followingPages && item.followingPages.length > 0 
            ? `<strong>Template Controls Pages:</strong> [${item.followingPages.join(', ')}]` 
            : `<strong>Status:</strong> Digital Records Pre-Seeded & Live in App`}
        </div>
      </div>
    `).join('');
    initLucide();
  } catch (err) {
    console.error('Error loading notebook archive:', err);
  }
}

// -------------------------------------------------------------
// LIVE CALCULATION HELPERS
// -------------------------------------------------------------
function calcInvoice() {
  const kg = parseFloat(document.getElementById('inv_kg').value) || 0;
  const rate = parseFloat(document.getElementById('inv_rate').value) || 0;
  const discount = parseFloat(document.getElementById('inv_discount').value) || 0;
  const isInterstate = parseInt(document.getElementById('inv_interstate').value) === 1;
  const ddAmount = parseFloat(document.getElementById('inv_dd_amount').value) || 0;

  const taxable = Math.max(0, (kg * rate) - discount);
  const gstRate = 0.05; // 5% GST
  const gstAmt = taxable * gstRate;
  const total = taxable + gstAmt;
  const bal = total - ddAmount;

  document.getElementById('previewTaxable').innerText = formatCurrency(taxable);
  document.getElementById('previewGst').innerText = `${formatCurrency(gstAmt)} (${isInterstate ? 'IGST 5%' : 'CGST 2.5% + SGST 2.5%'})`;
  document.getElementById('previewTotal').innerText = formatCurrency(total);
  document.getElementById('previewBalance').innerText = formatCurrency(bal);
}

function calcProcurement() {
  const count = parseFloat(document.getElementById('proc_count').value) || 0;
  const rate = parseFloat(document.getElementById('proc_rate').value) || 0;
  const coolie = parseFloat(document.getElementById('proc_coolie').value) || 0;
  const transport = parseFloat(document.getElementById('proc_transport').value) || 0;
  const advance = parseFloat(document.getElementById('proc_advance').value) || 0;

  const gross = count * rate;
  const net = gross - coolie - transport - advance;

  document.getElementById('previewProcGross').innerText = formatCurrency(gross);
  document.getElementById('previewProcNet').innerText = formatCurrency(net);
}

function calcDehusking() {
  const c4p = parseFloat(document.getElementById('dh_c4p').value) || 0;
  const cmo = parseFloat(document.getElementById('dh_cmo').value) || 0;
  const cpl = parseFloat(document.getElementById('dh_cpl').value) || 0;
  const util = parseFloat(document.getElementById('dh_utility').value) || 0;

  // Rates: 4P=0.90, MO=0.70, PL=1.00
  const gross = (c4p * 0.90) + (cmo * 0.70) + (cpl * 1.00);
  const net = gross - util;

  document.getElementById('previewDhGross').innerText = formatCurrency(gross);
  document.getElementById('previewDhNet').innerText = formatCurrency(net);
}

function calcHusk() {
  const trips = parseFloat(document.getElementById('husk_trips').value) || 0;
  const tripRate = parseFloat(document.getElementById('husk_triprate').value) || 0;
  const nutCount = parseFloat(document.getElementById('husk_nutcount').value) || 0;
  const nutRate = parseFloat(document.getElementById('husk_nutrate').value) || 0;
  const paid = parseFloat(document.getElementById('husk_paid').value) || 0;

  const total = (trips * tripRate) + (nutCount * nutRate);
  const bal = total - paid;

  document.getElementById('previewHuskTotal').innerText = formatCurrency(total);
  document.getElementById('previewHuskBal').innerText = formatCurrency(bal);
}

// -------------------------------------------------------------
// FORM SUBMISSION HANDLERS
// -------------------------------------------------------------
async function handleInvoiceSubmit(e) {
  e.preventDefault();
  const payload = {
    invoice_no: document.getElementById('inv_no').value,
    invoice_date: document.getElementById('inv_date').value,
    buyer_name: document.getElementById('inv_buyer').value,
    buyer_gstin: document.getElementById('inv_gstin').value,
    buyer_address: document.getElementById('inv_address').value,
    lorry_no: document.getElementById('inv_lorry').value,
    hsn_code: document.getElementById('inv_hsn').value,
    bag_count: document.getElementById('inv_bags').value,
    total_weight_kg: document.getElementById('inv_kg').value,
    rate_per_kg: document.getElementById('inv_rate').value,
    discount_amount: document.getElementById('inv_discount').value,
    is_interstate: document.getElementById('inv_interstate').value,
    dd_amount: document.getElementById('inv_dd_amount').value,
    dd_receipt_date: document.getElementById('inv_dd_date').value,
    bank_name: document.getElementById('inv_bank').value
  };

  const res = await fetch('/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalInvoice');
    loadInvoices();
    loadSummary();
    alert('Export invoice saved successfully! Tally XML voucher generated.');
  } else {
    alert('Failed to save invoice. Please verify invoice number is unique.');
  }
}

async function handleProcurementSubmit(e) {
  e.preventDefault();
  const payload = {
    farmer_name: document.getElementById('proc_farmer').value,
    date: document.getElementById('proc_date').value,
    batch_no: document.getElementById('proc_batch').value,
    quantity_count: document.getElementById('proc_count').value,
    unit_rate: document.getElementById('proc_rate').value,
    plucking_coolie: document.getElementById('proc_coolie').value,
    transport_deduction: document.getElementById('proc_transport').value,
    advance_paid: document.getElementById('proc_advance').value,
    payment_mode: document.getElementById('proc_mode').value
  };

  const res = await fetch('/api/procurements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalProcurement');
    loadProcurements();
    loadSummary();
  }
}

async function handleDehuskingSubmit(e) {
  e.preventDefault();
  const payload = {
    worker_name: document.getElementById('dh_worker').value,
    date: document.getElementById('dh_date').value,
    work_type: document.getElementById('dh_type').value,
    count_4p: document.getElementById('dh_c4p').value,
    count_mo: document.getElementById('dh_cmo').value,
    count_pl: document.getElementById('dh_cpl').value,
    utility_advance: document.getElementById('dh_utility').value
  };

  const res = await fetch('/api/dehusking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalDehusking');
    loadDehusking();
    loadSummary();
  }
}

async function handleCashBookSubmit(e) {
  e.preventDefault();
  const payload = {
    date: document.getElementById('cb_date').value,
    entry_type: document.getElementById('cb_type').value,
    category: document.getElementById('cb_category').value,
    amount: document.getElementById('cb_amount').value,
    particulars: document.getElementById('cb_particulars').value,
    payment_mode: document.getElementById('cb_mode').value,
    voucher_no: document.getElementById('cb_voucher').value
  };

  const res = await fetch('/api/cash-book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalCashBook');
    loadCashBook();
    loadSummary();
  }
}

async function handleManagerExpSubmit(e) {
  e.preventDefault();
  const payload = {
    date: document.getElementById('mgr_date').value,
    manager_name: document.getElementById('mgr_name').value,
    vehicle_no: document.getElementById('mgr_vehicle').value,
    expense_type: document.getElementById('mgr_type').value,
    meter_reading: document.getElementById('mgr_meter').value,
    amount: document.getElementById('mgr_amount').value,
    payment_mode: document.getElementById('mgr_mode').value,
    voucher_no: `PET-${Date.now().toString().slice(-4)}`
  };

  const res = await fetch('/api/manager-expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalManagerExp');
    loadManagerExpenses();
    loadCashBook();
    loadSummary();
    alert('Fuel expense logged and automatically debited from Cash Book!');
  }
}

async function handleHuskSubmit(e) {
  e.preventDefault();
  const payload = {
    supplier_name: document.getElementById('husk_supplier').value,
    date: document.getElementById('husk_date').value,
    vehicle_no: document.getElementById('husk_vehicle').value,
    husk_category: document.getElementById('husk_cat').value,
    trips: document.getElementById('husk_trips').value,
    trip_rate: document.getElementById('husk_triprate').value,
    nut_count: document.getElementById('husk_nutcount').value,
    nut_rate: document.getElementById('husk_nutrate').value,
    paid_amount: document.getElementById('husk_paid').value,
    payment_mode: document.getElementById('husk_bank').value
  };

  const res = await fetch('/api/husk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalHusk');
    loadHusk();
    loadSummary();
  }
}

// Bulk de-husking settlement
async function settleDehuskingBulk(id) {
  if (confirm('Confirm final bulk settlement for this worker upon home departure?')) {
    const res = await fetch(`/api/dehusking/${id}/settle`, { method: 'PUT' });
    if (res.ok) {
      loadDehusking();
      loadSummary();
    }
  }
}

// Delete record helper
async function deleteRecord(url, callback) {
  if (confirm('Are you sure you want to delete this record?')) {
    const res = await fetch(url, { method: 'DELETE' });
    if (res.ok) {
      callback();
      loadSummary();
    } else {
      alert('Could not delete record.');
    }
  }
}

// Download Tally XML file
function downloadTallyXml(id) {
  window.open(`/api/invoices/${id}/tally-xml`, '_blank');
}

// Export CSV file
function exportCsv(type) {
  window.open(`/api/export-csv/${type}`, '_blank');
}

// Print GST Invoice
function printInvoice(id) {
  const inv = (cachedData.invoices || []).find(i => i.id === id);
  if (!inv) return;

  document.getElementById('printBuyerName').innerText = inv.buyer_name;
  document.getElementById('printBuyerAddress').innerText = inv.buyer_address || 'Belagavi, Karnataka';
  document.getElementById('printBuyerGstin').innerText = inv.buyer_gstin || '29BDDPG0800P1ZK';
  document.getElementById('printInvNo').innerText = inv.invoice_no;
  document.getElementById('printInvDate').innerText = inv.invoice_date;
  document.getElementById('printLorry').innerText = inv.lorry_no || '-';
  document.getElementById('printDesc').innerText = inv.product_description;
  document.getElementById('printHsn').innerText = inv.hsn_code;
  document.getElementById('printBags').innerText = inv.bag_count;
  document.getElementById('printWeight').innerText = Number(inv.total_weight_kg).toLocaleString();
  document.getElementById('printRate').innerText = Number(inv.rate_per_kg).toFixed(2);
  document.getElementById('printTaxable').innerText = formatCurrency(inv.taxable_value);
  document.getElementById('printSumTaxable').innerText = formatCurrency(inv.taxable_value);
  document.getElementById('printSumGst').innerText = formatCurrency((inv.total_invoice_amount - inv.taxable_value));
  document.getElementById('printSumTotal').innerText = formatCurrency(inv.total_invoice_amount);

  window.print();
}

// Modal open/close helpers
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function openInvoiceModal() {
  document.getElementById('formInvoice').reset();
  setDefaultDates();
  calcInvoice();
  openModal('modalInvoice');
}

function openProcurementModal() {
  document.getElementById('formProcurement').reset();
  setDefaultDates();
  calcProcurement();
  openModal('modalProcurement');
}

function openDehuskingModal() {
  document.getElementById('formDehusking').reset();
  setDefaultDates();
  calcDehusking();
  openModal('modalDehusking');
}

function openCashBookModal() {
  document.getElementById('formCashBook').reset();
  setDefaultDates();
  openModal('modalCashBook');
}

function openManagerExpenseModal() {
  document.getElementById('formManagerExp').reset();
  setDefaultDates();
  openModal('modalManagerExp');
}

function openHuskModal() {
  document.getElementById('formHusk').reset();
  setDefaultDates();
  calcHusk();
  openModal('modalHusk');
}

function openCarrierModal() {
  document.getElementById('formCarrier').reset();
  setDefaultDates();
  openModal('modalCarrier');
}

function openGradingModal() {
  document.getElementById('formGrading').reset();
  setDefaultDates();
  openModal('modalGrading');
}

function openDispatchModal() {
  document.getElementById('formDispatch').reset();
  setDefaultDates();
  openModal('modalDispatch');
}

function openManagerSalaryModal() {
  document.getElementById('formManagerSalary').reset();
  openModal('modalManagerSalary');
}

async function openFarmerDirectoryModal() {
  openModal('modalFarmerDirectory');
  await loadFarmerDirectory();
}

async function loadFarmerDirectory() {
  try {
    const res = await fetch('/api/farmers');
    const farmers = await res.json();
    const tbody = document.getElementById('farmerDirectoryTbody');
    if (farmers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No farmers registered yet.</td></tr>';
      return;
    }
    tbody.innerHTML = farmers.map(f => `
      <tr>
        <td><strong>${f.name}</strong></td>
        <td>${f.phone || '-'}</td>
        <td>${f.village || '-'}</td>
        <td>${f.bank_name || '-'}</td>
        <td>${f.account_no || '-'}</td>
        <td>${f.ifsc_code || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading farmer directory:', err);
  }
}

async function handleNewFarmerSubmit(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('fm_name').value,
    phone: document.getElementById('fm_phone').value,
    village: document.getElementById('fm_village').value,
    bank_name: document.getElementById('fm_bank').value,
    account_no: document.getElementById('fm_acc').value,
    ifsc_code: document.getElementById('fm_ifsc').value
  };

  const res = await fetch('/api/farmers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    document.getElementById('formNewFarmer').reset();
    await loadFarmerDirectory();
    alert('Farmer profile saved successfully!');
  }
}

async function handleCarrierSubmit(e) {
  e.preventDefault();
  const payload = {
    worker_name: document.getElementById('cr_name').value,
    date: document.getElementById('cr_date').value,
    role: document.getElementById('cr_role').value,
    attendance: document.getElementById('cr_att').value,
    daily_fixed_rate: document.getElementById('cr_rate').value,
    utility_advance: document.getElementById('cr_adv').value
  };

  const res = await fetch('/api/carrier-wages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalCarrier');
    loadCarriers();
  }
}

async function handleGradingSubmit(e) {
  e.preventDefault();
  const payload = {
    group_name: document.getElementById('gr_team').value,
    date: document.getElementById('gr_date').value,
    vehicle_no: document.getElementById('gr_vehicle').value,
    gunny_bag_variant: document.getElementById('gr_variant').value,
    bag_count: document.getElementById('gr_bags').value,
    piece_count_per_bag: document.getElementById('gr_pcs').value,
    rate_per_bag: document.getElementById('gr_rate').value,
    utility_advance: document.getElementById('gr_adv').value
  };

  const res = await fetch('/api/group-grading', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalGrading');
    loadGrading();
  }
}

async function handleDispatchSubmit(e) {
  e.preventDefault();
  const payload = {
    lorry_no: document.getElementById('dsp_lorry').value,
    date: document.getElementById('dsp_date').value,
    broker_agency: document.getElementById('dsp_agency').value,
    route_from: document.getElementById('dsp_from').value,
    route_to: document.getElementById('dsp_to').value,
    total_bags: document.getElementById('dsp_bags').value,
    cargo_weight_kg: document.getElementById('dsp_weight').value,
    freight_amount: document.getElementById('dsp_freight').value,
    advance_freight: document.getElementById('dsp_adv').value,
    driver_phone: document.getElementById('dsp_phone').value
  };

  const res = await fetch('/api/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalDispatch');
    loadDispatch();
  }
}

async function handleManagerSalarySubmit(e) {
  e.preventDefault();
  const payload = {
    manager_name: document.getElementById('ms_name').value,
    month_year: document.getElementById('ms_month').value,
    monthly_salary: document.getElementById('ms_salary').value,
    advances_taken: document.getElementById('ms_adv').value,
    other_deductions: document.getElementById('ms_ded').value,
    payment_mode: document.getElementById('ms_mode').value,
    payment_date: new Date().toISOString().split('T')[0]
  };

  const res = await fetch('/api/manager-salaries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modalManagerSalary');
    loadManagerSalaries();
  }
}

// Real-time table search helper
function setupSearch(inputId, tbodyId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', () => {
    const term = input.value.toLowerCase();
    const rows = document.getElementById(tbodyId).querySelectorAll('tr');
    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  });
}

function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  return '₹ ' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
