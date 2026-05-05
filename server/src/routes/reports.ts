import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { db } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────────────

function fmt$(v: number): string {
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtL(v: number): string {
  return `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}L`;
}

function fmtDate(v: string): string {
  return new Date(v).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtTime(v: string): string {
  return new Date(v).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ─── PDF builder helpers (B&W optimized) ──────────────────────────────

const C = {
  black: '#000000',
  dark: '#1A1A1A',
  medium: '#555555',
  light: '#888888',
  rule: '#CCCCCC',
  headerBg: '#EEEEEE',
};

const PAGE_LEFT = 40;
const PAGE_RIGHT = 555;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;

function drawRule(doc: PDFKit.PDFDocument, y: number, weight = 0.5): number {
  doc.strokeColor(C.rule).lineWidth(weight).moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).stroke();
  return y;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.fontSize(10).font('Helvetica-Bold').fillColor(C.black).text(title.toUpperCase(), PAGE_LEFT, y);
  y += 14;
  doc.strokeColor(C.black).lineWidth(1).moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).stroke();
  return y + 6;
}

function drawTableHeader(doc: PDFKit.PDFDocument, headers: { label: string; x: number; width: number; align?: string }[], y: number): number {
  doc.rect(PAGE_LEFT, y, PAGE_WIDTH, 14).fillColor(C.headerBg).fill();
  doc.fontSize(7).font('Helvetica-Bold').fillColor(C.dark);
  for (const h of headers) {
    const opts: PDFKit.Mixins.TextOptions = { width: h.width, lineBreak: false };
    if (h.align === 'right') opts.align = 'right';
    doc.text(h.label, h.x, y + 3, opts);
  }
  return y + 16;
}

function drawTableRow(doc: PDFKit.PDFDocument, cells: { text: string; x: number; width: number; align?: string; bold?: boolean }[], y: number): number {
  doc.fontSize(7.5).fillColor(C.dark);
  for (const c of cells) {
    doc.font(c.bold ? 'Helvetica-Bold' : 'Helvetica');
    const opts: PDFKit.Mixins.TextOptions = { width: c.width, lineBreak: false };
    if (c.align === 'right') opts.align = 'right';
    doc.text(c.text, c.x, y, opts);
  }
  return y + 12;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, currentY: number): number {
  if (currentY + needed > 740) {
    doc.addPage();
    return 40;
  }
  return currentY;
}

// ─── Route ─────────────────────────────────────────────────────────────

// GET /api/reports/shifts/:id/pdf
router.get('/shifts/:id/pdf', requireAuth, requireRole('Manager'), async (req, res) => {
  try {
    const { id } = req.params;

    // ── Fetch all shift data ────────────────────────────────────────
    const shiftResult = await db.query(`
      SELECT s.*, u.name as manager_name
      FROM shifts s
      JOIN users u ON s.manager_id = u.id
      WHERE s.id = $1
    `, [id]);

    if (shiftResult.rowCount === 0) {
      res.status(404).json({ error: 'Turno no encontrado' });
      return;
    }

    const shift = shiftResult.rows[0];

    if (shift.status !== 'closed') {
      res.status(400).json({ error: 'Solo se pueden exportar turnos cerrados' });
      return;
    }

    const [assignmentsResult, transactionsResult, withdrawalsResult, readingsByHoseResult, txTotalsResult, totalWithdrawalsResult, pricesResult] = await Promise.all([
      db.query(`
        SELECT sa.*, u.name as dispatcher_name, p.number as pump_number, p.name as pump_name
        FROM shift_assignments sa
        JOIN users u ON sa.dispatcher_id = u.id
        JOIN pumps p ON sa.pump_id = p.id
        WHERE sa.shift_id = $1
        ORDER BY p.number, sa.started_at
      `, [id]),

      db.query(`
        SELECT t.*, u.name as recorded_by_name, p.number as pump_number, cc.name as credit_category_name
        FROM transactions t
        JOIN users u ON t.recorded_by = u.id
        LEFT JOIN pumps p ON t.pump_id = p.id
        LEFT JOIN credit_categories cc ON t.credit_category_id = cc.id
        WHERE t.shift_id = $1
        ORDER BY t.recorded_at ASC
      `, [id]),

      db.query(`
        SELECT w.*, u.name as recorded_by_name
        FROM withdrawals w
        JOIN users u ON w.recorded_by = u.id
        WHERE w.shift_id = $1
        ORDER BY w.recorded_at ASC
      `, [id]),

      // Liters dispensed per hose from meter readings
      db.query(`
        SELECT
          h.gas_type_id,
          h.id as hose_id,
          p.number as pump_number,
          gt.name as gas_type_name,
          gt.code as gas_type_code,
          MAX(CASE WHEN mr.reading_type = 'start' THEN mr.value END) as start_reading,
          MAX(CASE WHEN mr.reading_type = 'end' THEN mr.value END) as end_reading,
          COALESCE(
            MAX(CASE WHEN mr.reading_type = 'end' THEN mr.value END) -
            MAX(CASE WHEN mr.reading_type = 'start' THEN mr.value END),
            0
          ) as liters_dispensed
        FROM hoses h
        JOIN gas_types gt ON h.gas_type_id = gt.id
        JOIN pumps p ON h.pump_id = p.id
        LEFT JOIN meter_readings mr ON mr.hose_id = h.id AND mr.shift_id = $1
        WHERE h.is_active = true
        GROUP BY h.id, h.gas_type_id, gt.name, gt.code, p.number
        HAVING MAX(CASE WHEN mr.reading_type = 'start' THEN mr.value END) IS NOT NULL
        ORDER BY p.number, gt.code
      `, [id]),

      // Card and credit totals only (cash is NOT recorded)
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'Card' THEN amount ELSE 0 END), 0) as card_sales,
          COALESCE(SUM(CASE WHEN type = 'Credit' THEN amount ELSE 0 END), 0) as credit_sales,
          COUNT(*) as transaction_count
        FROM transactions WHERE shift_id = $1
      `, [id]),

      db.query(`
        SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE shift_id = $1
      `, [id]),

      db.query(`
        SELECT DISTINCT ON (gt.id) gt.id as gas_type_id, gt.name, gt.code, gp.price
        FROM gas_types gt
        LEFT JOIN gas_prices gp ON gp.gas_type_id = gt.id
          AND gp.effective_from <= $1
          AND (gp.effective_until IS NULL OR gp.effective_until > $1)
        ORDER BY gt.id, gp.effective_from DESC
      `, [shift.opened_at]),
    ]);

    const assignments = assignmentsResult.rows;
    const transactions = transactionsResult.rows;
    const withdrawals = withdrawalsResult.rows;
    const hoseReadings = readingsByHoseResult.rows;
    const prices = pricesResult.rows;

    // Build price lookup by gas_type_id
    const priceByGasType: Record<string, number> = {};
    for (const p of prices) {
      priceByGasType[p.gas_type_id] = Number(p.price);
    }

    // Calculate total liters and total sales from readings × prices
    let totalLiters = 0;
    let totalSales = 0;
    const salesByGasType: Array<{ name: string; code: string; liters: number; price: number; sales: number }> = [];

    const litersByGasType: Record<string, { liters: number; name: string; code: string }> = {};
    for (const r of hoseReadings) {
      const liters = Number(r.liters_dispensed);
      if (liters <= 0) continue;
      const gtId = r.gas_type_id;
      if (!litersByGasType[gtId]) {
        litersByGasType[gtId] = { liters: 0, name: r.gas_type_name, code: r.gas_type_code };
      }
      litersByGasType[gtId].liters += liters;
    }

    for (const [gasTypeId, data] of Object.entries(litersByGasType)) {
      const price = priceByGasType[gasTypeId] || 0;
      const sales = data.liters * price;
      totalLiters += data.liters;
      totalSales += sales;
      salesByGasType.push({ name: data.name, code: data.code, liters: data.liters, price, sales });
    }

    // Card/credit from transactions, cash is derived
    const txTotals = txTotalsResult.rows[0];
    const cardSales = Number(txTotals.card_sales);
    const creditSales = Number(txTotals.credit_sales);
    const cashSales = totalSales - cardSales - creditSales;
    const totalWithdrawals = Number(totalWithdrawalsResult.rows[0].total);

    // Derive the non-cash amounts bundled into withdrawals
    const nonCashInWithdrawalsResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE shift_id = $1 AND type != 'Cash' AND withdrawal_id IS NOT NULL`,
      [id]
    );
    const nonCashInWithdrawals = Number(nonCashInWithdrawalsResult.rows[0].total);
    const cashOnlyWithdrawals = totalWithdrawals - nonCashInWithdrawals;
    const cashInHand = cashSales - cashOnlyWithdrawals;

    // Unique dispatchers
    const dispatcherNames = [...new Set(assignments.map((a: any) => a.dispatcher_name))];

    // ── Build PDF ──────────────────────────────────────────────────
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 36, bottom: 36, left: 40, right: 40 },
      info: {
        Title: `Reporte de Turno #${id.slice(0, 8)}`,
        Author: 'Volumetrico',
        Subject: 'Reporte de Turno',
      },
    });

    // Stream response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="turno_${id.slice(0, 8)}_${new Date(shift.opened_at).toISOString().slice(0, 10)}.pdf"`);
    doc.pipe(res);

    // ── HEADER ─────────────────────────────────────────────────────
    // Thin top rule
    doc.strokeColor(C.black).lineWidth(2).moveTo(PAGE_LEFT, 20).lineTo(PAGE_RIGHT, 20).stroke();

    // Title
    doc.fontSize(18).font('Helvetica-Bold').fillColor(C.black).text('VOLUMETRICO', PAGE_LEFT, 28);
    doc.fontSize(9).font('Helvetica').fillColor(C.medium).text('Reporte de Turno', PAGE_LEFT, 48);

    // Right-aligned shift info
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.black).text(`Turno #${id.slice(0, 8)}`, 350, 28, { width: PAGE_RIGHT - 350, align: 'right' });
    doc.fontSize(8).font('Helvetica').fillColor(C.dark).text(`${fmtDate(shift.opened_at)}  →  ${fmtDate(shift.closed_at)}`, 350, 40, { width: PAGE_RIGHT - 350, align: 'right' });
    doc.fontSize(8).font('Helvetica').fillColor(C.medium).text(`Encargado: ${shift.manager_name}`, 350, 51, { width: PAGE_RIGHT - 350, align: 'right' });

    let y = 64;
    drawRule(doc, y, 1);
    y += 8;

    // ── RESUMEN FINANCIERO ─────────────────────────────────────────
    y = drawSectionTitle(doc, 'Resumen Financiero', y);

    // Inline key-value pairs, compact 2-column layout
    const col1X = PAGE_LEFT + 4;
    const col2X = 300;
    const labelW = 130;
    const valW = 100;

    const summaryRows: [string, string, string, string][] = [
      ['Ventas Totales:', fmt$(totalSales), 'Litros Despachados:', fmtL(totalLiters)],
      ['Efectivo (calculado):', fmt$(cashSales), 'Ventas con Tarjeta:', fmt$(cardSales)],
      ['Ventas a Crédito:', fmt$(creditSales), 'Total Retiros:', fmt$(totalWithdrawals)],
      ['Retiro Efectivo:', fmt$(cashOnlyWithdrawals), 'Retiro No-Efectivo:', fmt$(nonCashInWithdrawals)],
    ];

    for (const [l1, v1, l2, v2] of summaryRows) {
      doc.fontSize(8).font('Helvetica').fillColor(C.medium).text(l1, col1X, y, { width: labelW, lineBreak: false });
      doc.fontSize(9).font('Helvetica-Bold').fillColor(C.black).text(v1, col1X + labelW, y, { width: valW, lineBreak: false });
      doc.fontSize(8).font('Helvetica').fillColor(C.medium).text(l2, col2X, y, { width: labelW, lineBreak: false });
      doc.fontSize(9).font('Helvetica-Bold').fillColor(C.black).text(v2, col2X + labelW, y, { width: valW, lineBreak: false });
      y += 14;
    }

    // Highlight: Efectivo en Caja
    y += 2;
    doc.strokeColor(C.black).lineWidth(0.5).moveTo(col1X, y).lineTo(col1X + labelW + valW, y).stroke();
    y += 4;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.black).text('EFECTIVO EN CAJA:', col1X, y, { width: labelW, lineBreak: false });
    doc.fontSize(11).font('Helvetica-Bold').fillColor(C.black).text(fmt$(cashInHand), col1X + labelW, y - 1, { width: valW, lineBreak: false });

    // Gas prices
    if (prices.length > 0) {
      doc.fontSize(7).font('Helvetica').fillColor(C.light)
        .text(`Precios: ${prices.map((p: any) => `${p.name} $${Number(p.price).toFixed(2)}/L`).join('  •  ')}`, col2X, y + 2, { width: PAGE_RIGHT - col2X });
    }
    y += 18;

    // ── VENTAS POR COMBUSTIBLE (compact table) ─────────────────────
    y = ensureSpace(doc, 50, y);
    y = drawSectionTitle(doc, 'Ventas por Combustible', y);

    const fuelHeaders = [
      { label: 'COMBUSTIBLE', x: 42, width: 120 },
      { label: 'PRECIO/L', x: 162, width: 70, align: 'right' },
      { label: 'LITROS', x: 232, width: 80, align: 'right' },
      { label: 'VENTA', x: 312, width: 90, align: 'right' },
    ];
    y = drawTableHeader(doc, fuelHeaders, y);

    for (const gt of salesByGasType) {
      y = drawTableRow(doc, [
        { text: gt.name, x: 42, width: 120, bold: true },
        { text: `$${gt.price.toFixed(2)}`, x: 162, width: 70, align: 'right' },
        { text: fmtL(gt.liters), x: 232, width: 80, align: 'right' },
        { text: fmt$(gt.sales), x: 312, width: 90, align: 'right', bold: true },
      ], y);
    }
    // Total row
    doc.strokeColor(C.rule).lineWidth(0.5).moveTo(42, y - 1).lineTo(402, y - 1).stroke();
    y = drawTableRow(doc, [
      { text: 'TOTAL', x: 42, width: 120, bold: true },
      { text: '', x: 162, width: 70 },
      { text: fmtL(totalLiters), x: 232, width: 80, align: 'right', bold: true },
      { text: fmt$(totalSales), x: 312, width: 90, align: 'right', bold: true },
    ], y);
    y += 6;

    // ── LECTURAS DE MEDIDORES ──────────────────────────────────────
    if (hoseReadings.length > 0) {
      y = ensureSpace(doc, 50, y);
      y = drawSectionTitle(doc, 'Lecturas de Medidores', y);

      const rHeaders = [
        { label: 'BOMBA', x: 42, width: 70 },
        { label: 'COMBUSTIBLE', x: 112, width: 90 },
        { label: 'INICIAL', x: 202, width: 70, align: 'right' },
        { label: 'FINAL', x: 272, width: 70, align: 'right' },
        { label: 'LITROS DESP.', x: 342, width: 70, align: 'right' },
        { label: 'VENTA', x: 412, width: 80, align: 'right' },
      ];
      y = drawTableHeader(doc, rHeaders, y);

      for (const r of hoseReadings) {
        y = ensureSpace(doc, 14, y);
        const liters = Number(r.liters_dispensed);
        const price = priceByGasType[r.gas_type_id] || 0;
        const hasEnd = r.end_reading != null;
        y = drawTableRow(doc, [
          { text: `#${r.pump_number}`, x: 42, width: 70, bold: true },
          { text: r.gas_type_name, x: 112, width: 90 },
          { text: r.start_reading != null ? fmtL(Number(r.start_reading)) : '-', x: 202, width: 70, align: 'right' },
          { text: hasEnd ? fmtL(Number(r.end_reading)) : '-', x: 272, width: 70, align: 'right' },
          { text: hasEnd ? fmtL(liters) : '-', x: 342, width: 70, align: 'right', bold: liters > 0 },
          { text: hasEnd && liters > 0 ? fmt$(liters * price) : '-', x: 412, width: 80, align: 'right', bold: liters > 0 },
        ], y);
      }
      y += 6;
    }

    // ── TRANSACCIONES (Tarjeta & Crédito) ─────────────────────────
    if (transactions.length > 0) {
      y = ensureSpace(doc, 50, y);
      y = drawSectionTitle(doc, 'Transacciones Registradas', y);

      const txHeaders = [
        { label: 'HORA', x: 42, width: 40 },
        { label: 'TIPO', x: 82, width: 50 },
        { label: 'BOMBA', x: 132, width: 40 },
        { label: 'MONTO', x: 172, width: 70, align: 'right' },
        { label: 'NOTA / CATEGORÍA', x: 250, width: 170 },
        { label: 'REGISTRÓ', x: 420, width: 90 },
      ];
      y = drawTableHeader(doc, txHeaders, y);

      for (const t of transactions) {
        y = ensureSpace(doc, 14, y);
        const typeLabel = t.type === 'Card' ? 'Tarjeta' : t.type === 'Credit' ? 'Crédito' : t.type;
        const note = [t.note, t.credit_category_name].filter(Boolean).join(' — ') || '-';
        y = drawTableRow(doc, [
          { text: fmtTime(t.recorded_at), x: 42, width: 40 },
          { text: typeLabel, x: 82, width: 50, bold: true },
          { text: t.pump_number ? `#${t.pump_number}` : '-', x: 132, width: 40 },
          { text: fmt$(Number(t.amount)), x: 172, width: 70, align: 'right', bold: true },
          { text: note, x: 250, width: 170 },
          { text: t.recorded_by_name, x: 420, width: 90 },
        ], y);
      }
      y += 6;
    }

    // ── RETIROS ────────────────────────────────────────────────────
    if (withdrawals.length > 0) {
      y = ensureSpace(doc, 50, y);
      y = drawSectionTitle(doc, 'Retiros', y);

      const wHeaders = [
        { label: 'HORA', x: 42, width: 50 },
        { label: 'CONCEPTO', x: 92, width: 220 },
        { label: 'MONTO', x: 312, width: 90, align: 'right' },
        { label: 'REGISTRÓ', x: 420, width: 90 },
      ];
      y = drawTableHeader(doc, wHeaders, y);

      for (const w of withdrawals) {
        y = ensureSpace(doc, 14, y);
        y = drawTableRow(doc, [
          { text: fmtTime(w.recorded_at), x: 42, width: 50 },
          { text: w.note || '-', x: 92, width: 220 },
          { text: `-${fmt$(Number(w.amount))}`, x: 312, width: 90, align: 'right', bold: true },
          { text: w.recorded_by_name, x: 420, width: 90 },
        ], y);
      }
      y += 6;
    }

    // ── ASIGNACIONES (compact) ─────────────────────────────────────
    if (assignments.length > 0) {
      y = ensureSpace(doc, 50, y);
      y = drawSectionTitle(doc, 'Asignaciones', y);

      const aHeaders = [
        { label: 'BOMBA', x: 42, width: 70 },
        { label: 'DESPACHADOR', x: 112, width: 140 },
        { label: 'ENTRADA', x: 252, width: 60, align: 'right' },
        { label: 'SALIDA', x: 312, width: 60, align: 'right' },
      ];
      y = drawTableHeader(doc, aHeaders, y);

      for (const a of assignments) {
        y = ensureSpace(doc, 14, y);
        y = drawTableRow(doc, [
          { text: `#${a.pump_number}`, x: 42, width: 70, bold: true },
          { text: a.dispatcher_name, x: 112, width: 140 },
          { text: fmtTime(a.started_at), x: 252, width: 60, align: 'right' },
          { text: a.ended_at ? fmtTime(a.ended_at) : '-', x: 312, width: 60, align: 'right' },
        ], y);
      }
      y += 6;
    }

    // ── SIGNATURE BLOCK ───────────────────────────────────────────
    // Ensure enough space for signatures (need ~100px)
    y = ensureSpace(doc, 110, y);

    y += 10;
    drawRule(doc, y, 0.5);
    y += 16;

    // Two signature columns
    const sigCol1 = PAGE_LEFT + 20;
    const sigCol2 = 320;
    const sigLineW = 180;

    // Signature lines
    const sigY = y + 40;

    doc.strokeColor(C.black).lineWidth(0.5)
      .moveTo(sigCol1, sigY).lineTo(sigCol1 + sigLineW, sigY).stroke()
      .moveTo(sigCol2, sigY).lineTo(sigCol2 + sigLineW, sigY).stroke();

    // Labels under lines
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.dark);
    doc.text('Encargado / Cajero', sigCol1, sigY + 4, { width: sigLineW, align: 'center' });
    doc.text('Despachador', sigCol2, sigY + 4, { width: sigLineW, align: 'center' });

    // Pre-fill names in lighter text above the lines
    doc.fontSize(7).font('Helvetica').fillColor(C.light);
    doc.text(shift.manager_name, sigCol1, sigY - 12, { width: sigLineW, align: 'center' });
    doc.text(dispatcherNames.join(', '), sigCol2, sigY - 12, { width: sigLineW, align: 'center' });

    y = sigY + 20;

    // ── FOOTER ─────────────────────────────────────────────────────
    y += 10;
    doc.fontSize(6).font('Helvetica').fillColor(C.light)
      .text(`Generado: ${fmtDate(new Date().toISOString())}  •  Turno #${id.slice(0, 8)}  •  Volumetrico`, PAGE_LEFT, y, { width: PAGE_WIDTH, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('PDF report error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar el reporte' });
    }
  }
});

export default router;
