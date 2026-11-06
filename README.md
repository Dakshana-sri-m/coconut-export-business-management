# Coconut Export Business Management System
### தென்னை ஏற்றுமதி வணிக மேலாண்மை மென்பொருள்

A specialized, modern enterprise web application built specifically for a **Coconut Export & Processing Enterprise**, developed by directly analyzing and digitizing 16 pages of handwritten physical notebook records and incorporating operational workflows for farmers, piece-rate de-husking labor, carrier handlers, vehicle logistics, manager expense accounting, and **TallyPrime B2B Export Invoicing**.

---

## 1. Physical Notebook Architecture & Digital Module Mapping

The system strictly adheres to the principle that **each handwritten labeled divider page defines the schema and business format for the records following it**:

| Scanned Page | Original Notebook Handwritten Label / Title | Purpose & Content | Digital Module in Application |
|---|---|---|---|
| **Page 1 → Page 2** | `லோடிங் வண்டித்தாள் நோட்` (Loading Sheet Note) | Vehicle No (TN 38 AJ 4386), Broker (M/s SD Coimbatore), Route, Bags breakdown (970 bags, 47,950 units), Cargo weight (17,130 kg), Freight (Rs. 49,700), Driver (9751399029). | **Transport & Lorry Dispatch (வண்டித்தாள்)** |
| **Page 3 → Page 4** | `லோடுமேன் கூலிக்கு நோட்டு (20/10/2025 முதல்)` | Thiru. Sivapandi Chetty (Ayyampalayam). Loading coolie per lorry, coconut grades (KN, 4P loose), daily batta (படி), earned wages (கூலி Rs. 93,504), advances (பற்று Rs. 177,500). | **Loadman Labor Coolie (லோடுமேன் கூலி)** |
| **Page 5 → Pages 6 & 7** | `மட்டை கொள்முதல் நோட்டு (01/04/2026 முதல்)` | Coconut husk purchase from Thiru. Balamurugan & Ex MLA Vadivel. Eicher lorry trips (13 KN trips, 6 MO trips @ Rs. 13,500/trip), nut count (53,310 nuts @ Rs. 1.25), total bill Rs. 2,92,762, Canara Bank payments. | **Coconut Husk (Mattai) Purchases (மட்டை கொள்முதல்)** |
| **Page 8 → Pages 9 & 10** | `வரவு - செலவு தினசரி நோட்டு (01/04/2026 முதல்)` | Daily cash book: Pulsar petrol, cement pillars, Andhra net vessels, picking 11,670 nuts coolie (Rs. 2,050), tractor picking 14,560 nuts (Rs. 2,550), carrier wages, SBI online receipts (Ajith kumar Rs. 4,00,000). | **Cash & Bank Book (வரவு - செலவு தினசரி கணக்கு)** |
| **Page 11 → Page 12** | `Parties Note 2026 to 2027 முதல்` | M/s Shree Renuka Traders (Belagavi, Karnataka). GSTIN: 29BDDPG0800P1ZK, 11 export bills, net weights (6,070 to 10,290 kg), rates (Rs. 48.50 to 61.50/kg), Demand Drafts (DD) via Canara Bank. | **Export Invoicing & Tally (வாடிக்கையாளர் விற்பனை)** |
| **Page 13 → Page 14** | `கிரையச் செலவு & குத்தகை நோட்டு (01/11/2024 முதல்)` | Ganesan Chettu / Uriyur grove harvesting. 1,17,360 coconuts harvested, plucking coolie, advances paid (Rs. 94,300), crop settlement (Rs. 99,756). | **Farmers & Coconut Incoming (தோட்ட அறுவடை & குத்தகை)** |
| **Page 15 → Page 16** | `ஊழியர் கணக்கு நோட்டு (20/10/2025)` | Muthu (Vazhapandal) peeling wages. 61,340 nuts: 4P @ Rs. 900/1k, MO @ Rs. 700/1k, PL @ Rs. 1000/1k. Daily utility advances offset against final bulk payout upon leaving for home. | **Coconut De-husking Labor (ஊழியர் உரிக்கும் கூலி)** |

---

## 2. Key Business Features & Workflow Support

1. **Farmer Procurement & Incoming**:
   - Track farmer profile, village, contact, and banking details (A/c, IFSC, Bank name, UPI).
   - Enter plucked coconut counts or weights with rate per nut/kg.
   - Automatic deduction of harvesting coolie, transport freight, and advance draws.
   - Live settlement recording.

2. **Dual-Tier De-husking (Individuals & Groups)**:
   - Piece-rate wage calculation for 3 distinct variants: **4P / KN** (Rs. 0.90/nut), **MO** (Rs. 0.70/nut), and **PL** (Rs. 1.00/nut).
   - Tracks **Daily Utility Advances (தினசரி படி / செலவு)** taken for routine sustenance.
   - One-click **Settle Home Departure** calculates and records final bulk wage payout.

3. **Carriers, Coconut Handlers & Drivers**:
   - Fixed daily wage tracking with full-day, half-day, and absent statuses.
   - Utility advance offsets.

4. **Group Grading & Gunny Bag Assortment**:
   - Consignment assortment by gunny bag variant (e.g. Grade A - 41 count bag, Grade B - 71 count bag).
   - Automatic group piece wage calculation.

5. **Lorry Dispatch & Consignments**:
   - Loading sheets recording vehicle number, transport broker, route, total bags, gross cargo weight in kg, freight charge, advance freight, and driver contact number.

6. **TallyPrime Export Invoices & GST Compliance**:
   - B2B invoices with seller GSTIN (33 - Tamil Nadu) and buyer GSTIN (29 - Karnataka).
   - HSN Code `08011210` (Fresh Semi-Husked Coconuts).
   - Automatic IGST (5%) or CGST (2.5%) + SGST (2.5%) calculation.
   - Demand Draft (DD) and bank reconciliation.
   - **Download Tally XML**: Produces standard Tally XML vouchers ready to import directly into TallyPrime via `Import Data > Transactions`.
   - **Print GST Invoice**: Formatted for standard paper invoice printing.

7. **Manager Fleet, Petrol & Payroll**:
   - Fuel expense vouchers for manager vehicles (Pulsar bike, cars) with meter readings.
   - **Automatic Cash Book Debit Integration**: Fuel vouchers automatically debit from the Cash Book.
   - Manager monthly salaries with advance deductions.

8. **Double-Entry Cash & Bank Book**:
   - Debit (செலவு) and Credit (வரவு) ledger.
   - Tracks diesel, electricity bills, auditing fees, packing materials, customer receipts, and bank withdrawals.

---

## 3. How to Run the Application

The application is fully self-contained using Node.js built-in runtime (`agy-node` / Node.js 24) and native `node:sqlite`. Zero external npm dependencies are required.

### Quick Start:
Double-click `start.bat` on your desktop, or run in Powershell:
```powershell
set ELECTRON_RUN_AS_NODE=1
"C:\Users\Admin\AppData\Local\Programs\antigravity\Antigravity.exe" server/server.js
```

Then open your browser and navigate to:
```
http://localhost:3000
```

### Running Integration Tests:
```powershell
set ELECTRON_RUN_AS_NODE=1
"C:\Users\Admin\AppData\Local\Programs\antigravity\Antigravity.exe" test/full_verification.js
```

---

## 4. How to Import Invoices into TallyPrime

1. In the web application, go to **Tally Export Invoices**.
2. For any invoice, click the **Tally** button.
3. An XML file named `Tally_Invoice_BILL-XX.xml` will download.
4. Open **TallyPrime**.
5. Select your company (or create `COCONUT EXPORT ENTERPRISE`).
6. Navigate to **Import Data > Transactions**.
7. Choose the downloaded XML file and press Enter.
8. The sales voucher with party ledger, inventory allocation, and GST ledgers will be imported.
