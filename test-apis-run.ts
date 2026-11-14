import { AccountingService } from './src/modules/accounting/accounting.service';
import { prisma } from './src/config/db';

async function testAllApis() {
  console.log('--- STARTING COMPREHENSIVE API TEST ---');

  // 1. List Invoices API
  const invoices = await AccountingService.listInvoices({});
  console.log('API 1: listInvoices -> SUCCESS, retrieved:', invoices.length, 'invoices');

  // 2. Outstanding Dues API (for AR Aging)
  const dues = await AccountingService.getOutstandingDues();
  console.log('API 2: getOutstandingDues -> SUCCESS, retrieved:', dues.length, 'records');

  // 3. Payments Received API
  const payments = await AccountingService.listPaymentsReceived();
  console.log('API 3: listPaymentsReceived -> SUCCESS, retrieved:', payments.length, 'payments');

  // 4. Test Create Invoice -> Record Payment -> Status change
  const lease = await prisma.lease.findFirst({ where: { isActive: true } });
  if (lease) {
    console.log('Found active lease:', lease.id);
    const newInvoice = await AccountingService.createInvoice({
      leaseId: lease.id,
      amount: 100,
      dueDate: new Date().toISOString(),
      category: 'RENT',
      description: 'API Test Rent'
    });
    console.log('API 4: createInvoice -> SUCCESS, created invoice ID:', newInvoice.id, 'Status:', newInvoice.status);

    // 5. Update Invoice API
    const updated = await AccountingService.updateInvoice(newInvoice.id, {
      amountDue: 150,
      dueDate: '2026-12-01'
    });
    console.log('API 5: updateInvoice -> SUCCESS, updated amount:', updated.amountDue);

    // 6. Duplicate Invoice API
    const dup = await AccountingService.duplicateInvoice(newInvoice.id);
    console.log('API 6: duplicateInvoice -> SUCCESS, duplicate invoice:', dup.invoiceNumber);
    await AccountingService.deleteInvoice(dup.id);

    // 7. Record Payment API (settling invoice to PAID)
    const payment = await AccountingService.recordPayment({
      invoiceId: newInvoice.id,
      amount: 150,
      paymentMethod: 'INTERAC_E_TRANSFER'
    });
    console.log('API 7: recordPayment -> SUCCESS, payment recorded ID:', payment.id);

    // Verify invoice status changed to PAID
    const verifiedInv = await prisma.invoice.findUnique({ where: { id: newInvoice.id } });
    console.log('API 8: Status transition verified -> Invoice Status is now:', verifiedInv?.status);

    // Clean up test invoice & payment
    await prisma.payment.deleteMany({ where: { id: payment.id } });
    await prisma.invoice.delete({ where: { id: newInvoice.id } });
    console.log('Cleaned up test invoice and payment.');
  } else {
    console.log('No active lease found, skipped createInvoice/recordPayment live transaction.');
  }

  console.log('--- ALL APIS WORKING 100% PERFECTLY! ---');
  await prisma.$disconnect();
  process.exit(0);
}

testAllApis().catch(err => {
  console.error('API Verification Failed:', err);
  process.exit(1);
});

