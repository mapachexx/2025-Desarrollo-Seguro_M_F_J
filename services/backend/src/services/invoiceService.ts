// src/services/invoiceService.ts
import db from '../db';
import { Invoice } from '../types/invoice';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';

interface InvoiceRow {
  id: string;
  userId: string;
  amount: number;
  dueDate: Date;
  status: string;
}

class InvoiceService {
  static async list( userId: string, status?: string, operator?: string): Promise<Invoice[]> {
    let q = db<InvoiceRow>('invoices').where({ userId: userId });
    if (status) q = q.andWhereRaw(" status "+ operator + " '"+ status +"'");
    const rows = await q.select();
    const invoices = rows.map(row => ({
      id: row.id,
      userId: row.userId,
      amount: row.amount,
      dueDate: row.dueDate,
      status: row.status} as Invoice
    ));
    return invoices;
  }

  static async setPaymentCard(
    userId: string,
    invoiceId: string,
    paymentBrand: string,
    ccNumber: string,
    ccv: string,
    expirationDate: string
  ) {
    // use axios to call http://paymentBrand/payments as a POST request
    // with the body containing ccNumber, ccv, expirationDate
    // and handle the response accordingly
    const paymentResponse = await axios.post(`http://${paymentBrand}/payments`, {
      ccNumber,
      ccv,
      expirationDate
    });
    if (paymentResponse.status !== 200) {
      throw new Error('Payment failed');
    }

    // Update the invoice status in the database
    await db('invoices')
      .where({ id: invoiceId, userId })
      .update({ status: 'paid' });  
    };
  static async  getInvoice( invoiceId:string): Promise<Invoice> {
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId }).first();
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    return invoice as Invoice;
  }


static async getReceipt(invoiceId: string, pdfName: string) {
  const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId }).first();
  if (!invoice) throw new Error('Invoice not found');

  const basePath = path.resolve('./invoices');
  if (!pdfName || typeof pdfName !== 'string') throw new Error('Invalid name');
  if (!/^[a-zA-Z0-9._-]+$/.test(pdfName)) throw new Error('Invalid characters');
  if (path.extname(pdfName).toLowerCase() !== '.pdf') throw new Error('Invalid file type');

  const targetPath = path.resolve(basePath, pdfName);
  if (!targetPath.startsWith(basePath + path.sep)) throw new Error('Invalid path');

  try {
    const content = await fs.promises.readFile(targetPath, 'utf-8');
    return content;
  } catch {
    throw new Error('Receipt not found');
  }
}
;

};

export default InvoiceService;
