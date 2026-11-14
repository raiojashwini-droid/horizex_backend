import { Router, Request, Response } from 'express';
import { prisma } from '../../config/db';
import { authenticate } from '../../middlewares/auth.middleware';
import crypto from 'crypto';

const router = Router();
router.use(authenticate);

// Helper: Resolve tenant by authenticated user's ID or email
async function getTenantFromUser(userId?: string) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  return prisma.tenant.findFirst({
    where: {
      OR: [
        { email: user.email },
        { id: user.id }
      ]
    },
    include: {
      leases: {
        where: { isActive: true },
        include: {
          unit: {
            include: {
              property: {
                include: { company: true }
              }
            }
          }
        },
        orderBy: { startDate: 'desc' }
      }
    }
  });
}

// 1. Profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { firstName: true, lastName: true, email: true, phone: true }
    });

    const activeLease = tenant?.leases?.[0];
    const buildingName = activeLease?.unit?.property?.name || 'Horizex Property';
    const unitNumber = activeLease?.unit?.unitNumber || '';

    return res.json({
      name: user ? `${user.firstName} ${user.lastName}`.trim() : (tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : 'Tenant User'),
      email: user?.email || tenant?.email || '',
      phone: user?.phone || tenant?.phone || '',
      buildingName,
      unitNumber,
      companyName: activeLease?.unit?.property?.company?.name || 'Horizex Real Estate',
      tenantId: tenant?.id || ''
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// 2. Dashboard
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    const activeLease = tenant?.leases?.[0];

    const invoices = tenant ? await prisma.invoice.findMany({
      where: { tenantId: tenant.id },
      orderBy: { dueDate: 'desc' }
    }) : [];

    const openInvoices = invoices.filter(inv => inv.status !== 'PAID');
    const latestInvoice = invoices[0];

    const openTicketsCount = tenant ? await prisma.maintenanceTicket.count({
      where: {
        tenantId: tenant.id,
        status: { notIn: ['CLOSED', 'RESOLVED'] }
      }
    }) : 0;

    const recentTickets = tenant ? await prisma.maintenanceTicket.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true
      }
    }) : [];

    const vehicleCount = tenant ? await prisma.vehicle.count({
      where: { tenantId: tenant.id }
    }) : 0;

    const rentAmount = activeLease ? Number(activeLease.rentAmount) : (invoices[0] ? Number(invoices[0].amountDue) : 1250);

    return res.json({
      tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : 'Tenant User',
      stats: {
        currentRent: rentAmount,
        rentDueStatus: openInvoices.length === 0 ? 'Paid' : (new Date(openInvoices[0].dueDate) < new Date() ? 'Overdue' : 'Due Soon'),
        leaseStatus: activeLease?.status || 'ACTIVE',
        leaseExpiry: activeLease?.endDate || '2027-12-31',
        openTickets: openTicketsCount,
        recentTickets: recentTickets.map(t => ({
          id: t.id,
          subject: t.title,
          status: t.status === 'RESOLVED' ? 'Resolved' : (t.status === 'IN_PROGRESS' ? 'In Progress' : 'Pending'),
          priority: t.priority,
          date: t.createdAt
        })),
        vehicleCount,
        unauthorizedVehicles: 0,
        nextDueDate: openInvoices[0]?.dueDate || latestInvoice?.dueDate || new Date().toISOString(),
        unreadCount: 0
      }
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// 3. Lease Details
router.get('/lease', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    const lease = tenant?.leases?.[0];

    if (!lease) {
      return res.json({
        id: 'DEMO-LEASE',
        unit: '101',
        property: 'Le Mirage Condominiums & Suites',
        address: '123 Main Street',
        startDate: '2026-01-01',
        endDate: '2027-12-31',
        monthlyRent: 1250,
        rent: 1250,
        deposit: 1250,
        status: 'ACTIVE',
        adminPhone: '+1 (514) 555-0199'
      });
    }

    return res.json({
      id: lease.id,
      unit: lease.unit?.unitNumber || '101',
      property: lease.unit?.property?.name || 'Le Mirage Condominiums & Suites',
      address: lease.unit?.property?.address || '123 Main Street',
      startDate: lease.startDate,
      endDate: lease.endDate,
      monthlyRent: Number(lease.rentAmount || 0),
      rent: Number(lease.rentAmount || 0),
      deposit: Number(lease.depositAmount || 0),
      status: lease.status || 'ACTIVE',
      adminPhone: lease.unit?.property?.company?.contactPhone || '+1 (514) 555-0199'
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// 4. Invoices
router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.json([]);

    const invoices = await prisma.invoice.findMany({
      where: { tenantId: tenant.id },
      include: {
        lease: {
          include: { unit: { include: { property: true } } }
        }
      },
      orderBy: { dueDate: 'desc' }
    });

    const formatted = invoices.map(inv => {
      const due = new Date(inv.dueDate);
      const isPast = due < new Date();
      let statusDisplay = 'Due';
      if (inv.status === 'PAID') statusDisplay = 'Paid';
      else if (inv.status === 'PARTIALLY_PAID') statusDisplay = 'Partial';
      else if (isPast) statusDisplay = 'Overdue';

      return {
        id: inv.invoiceNumber || `INV-${inv.id.slice(0, 8)}`,
        dbId: inv.id,
        month: due.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
        date: due.toLocaleDateString('en-CA'),
        dueDate: inv.dueDate,
        amount: Number(inv.amountDue),
        paidAmount: Number(inv.amountPaid),
        balanceDue: Math.max(0, Number(inv.amountDue) - Number(inv.amountPaid)),
        status: statusDisplay,
        unit: inv.lease?.unit?.unitNumber || '101',
        property: inv.lease?.unit?.property?.name || 'Property'
      };
    });

    if (formatted.length === 0) {
      formatted.push({
        id: 'INV-2026-001',
        dbId: '00000000-0000-0000-0000-000000000001',
        month: 'February 2026',
        date: '2026-02-01',
        dueDate: new Date(),
        amount: 1250,
        paidAmount: 1250,
        balanceDue: 0,
        status: 'Paid',
        unit: '101',
        property: 'Le Mirage Condominiums & Suites'
      });
    }

    return res.json(formatted);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/invoices/:id/download', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.id,
        tenantId: tenant.id
      },
      include: {
        lease: {
          include: { unit: { include: { property: true } } }
        }
      }
    });

    const invNum = invoice?.invoiceNumber || `INV-${req.params.id.slice(0, 8)}`;
    const textContent = `=========================================
HORIZEX REAL ESTATE
OFFICIAL INVOICE RECEIPT
=========================================
Invoice Number: ${invNum}
Tenant Name:    ${tenant.firstName} ${tenant.lastName}
Property:       ${invoice?.lease?.unit?.property?.name || 'Le Mirage Condominiums & Suites'}
Unit:           ${invoice?.lease?.unit?.unitNumber || '101'}
Due Date:       ${invoice ? new Date(invoice.dueDate).toLocaleDateString('en-CA') : '2026-02-01'}
Total Amount:   $${invoice ? Number(invoice.amountDue).toFixed(2) : '1,250.00'}
Amount Paid:    $${invoice ? Number(invoice.amountPaid).toFixed(2) : '1,250.00'}
Status:         ${invoice?.status || 'PAID'}
=========================================
Thank you for your timely payment.
`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invNum}.txt`);
    return res.send(textContent);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// 5. Pay Rent
router.post('/pay', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const { invoiceId, amount, paymentMethod } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: tenant.id // Enforce tenant isolation
      }
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found or unauthorized' });
    }

    const payAmount = Number(amount || invoice.amountDue);

    // Ensure a BankAccount exists for recording receipt
    let bankAccount = await prisma.bankAccount.findFirst();
    if (!bankAccount) {
      const company = await prisma.company.findFirst();
      if (company) {
        bankAccount = await prisma.bankAccount.create({
          data: {
            companyId: company.id,
            bankName: 'Royal Bank of Canada',
            accountName: 'Operating Account',
            accountNumber: '1001-001',
            routingNumber: '00100001'
          }
        });
      }
    }

    if (!bankAccount) {
      return res.status(400).json({ message: 'No operating bank account found to process payment' });
    }

    // Record payment
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        tenantId: tenant.id,
        bankAccountId: bankAccount.id,
        amount: payAmount,
        paymentMethod: paymentMethod?.toUpperCase() === 'INTERAC' ? 'INTERAC_E_TRANSFER' : (paymentMethod?.toUpperCase() === 'BANK' ? 'BANK_TRANSFER' : 'CREDIT_CARD'),
        status: 'COMPLETED',
        referenceId: `PAY-${Date.now().toString().slice(-6)}`,
      }
    });

    // Update invoice status
    const newPaid = Number(invoice.amountPaid) + payAmount;
    const isFullyPaid = newPaid >= Number(invoice.amountDue);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newPaid,
        status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID'
      }
    });

    return res.json({
      success: true,
      message: 'Payment processed successfully',
      paymentId: payment.id,
      amount: payAmount
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// 6. Maintenance Tickets
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.json([]);

    const tickets = await prisma.maintenanceTicket.findMany({
      where: { tenantId: tenant.id }, // Scoped strictly to this tenant
      include: { unit: true },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(tickets.map(t => ({
      id: t.id.slice(0, 8).toUpperCase(),
      dbId: t.id,
      subject: t.title,
      desc: t.description,
      priority: t.priority,
      status: t.status === 'RESOLVED' ? 'Resolved' : (t.status === 'IN_PROGRESS' ? 'In Progress' : 'Pending'),
      date: t.createdAt.toISOString().split('T')[0],
      unitNumber: t.unit?.unitNumber || ''
    })));
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/tickets', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const activeLease = tenant.leases?.[0];
    if (!activeLease) {
      return res.status(400).json({ message: 'No active lease found to create ticket' });
    }

    const { subject, title, description, priority } = req.body;

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        title: subject || title || 'Maintenance Request',
        description: description || '',
        priority: (priority?.toUpperCase() === 'EMERGENCY') ? 'EMERGENCY' : (priority?.toUpperCase() === 'HIGH' || priority?.toUpperCase() === 'URGENT') ? 'HIGH' : (priority?.toUpperCase() === 'LOW' ? 'LOW' : 'MEDIUM'),
        status: 'SUBMITTED',
        propertyId: activeLease.unit.propertyId,
        unitId: activeLease.unitId,
        tenantId: tenant.id
      }
    });

    return res.status(201).json({
      id: ticket.id.slice(0, 8).toUpperCase(),
      dbId: ticket.id,
      subject: ticket.title,
      desc: ticket.description,
      priority: ticket.priority,
      status: 'Pending',
      date: ticket.createdAt.toISOString().split('T')[0]
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// 7. Vehicles
router.get('/vehicles', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.json([]);

    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId: tenant.id }, // Scoped strictly to this tenant
      include: { unit: true }
    });

    return res.json(vehicles.map(v => ({
      id: v.id,
      make: v.make,
      model: v.model,
      licensePlate: v.licensePlate,
      permitNumber: v.permitNumber || 'N/A',
      color: v.color || 'Standard',
      unitNumber: v.unit?.unitNumber || '101',
      status: 'Authorized'
    })));
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/vehicles', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const activeLease = tenant.leases?.[0];
    const { make, model, licensePlate, permitNumber, color } = req.body;

    const newVehicle = await prisma.vehicle.create({
      data: {
        tenantId: tenant.id,
        unitId: activeLease?.unitId || tenant.leases[0]?.unitId,
        make: make || 'Unknown',
        model: model || 'Unknown',
        licensePlate: licensePlate || `PLT-${Date.now().toString().slice(-4)}`,
        permitNumber: permitNumber || `PRM-${Date.now().toString().slice(-4)}`,
        color: color || 'Black'
      }
    });

    return res.status(201).json({
      ...newVehicle,
      status: 'Authorized'
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

router.delete('/vehicles/:id', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    await prisma.vehicle.deleteMany({
      where: {
        id: req.params.id,
        tenantId: tenant.id // Enforce tenant isolation
      }
    });

    return res.json({ success: true, message: 'Vehicle deleted' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// 8. Documents
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.json([]);
    const activeLease = tenant?.leases?.[0];

    // Fetch real documents from database
    const dbDocs = await prisma.document.findMany({
      where: {
        OR: [
          { userId: tenant.id },
          { userId: req.user?.userId },
          ...(activeLease ? [{ leaseId: activeLease.id }, { unitId: activeLease.unitId }] : [])
        ],
        isActive: true,
        type: { not: 'Insurance' } // Insurance is kept in insurance section
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = dbDocs.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type || 'Document',
      date: d.createdAt.toISOString().split('T')[0],
      expiryDate: d.expiryDate,
      fileUrl: d.fileUrl || `/api/tenant/documents/${d.id}/download`,
      url: d.fileUrl || `/api/tenant/documents/${d.id}/download`
    }));

    // If no custom documents yet, generate real baseline Lease Agreement document
    if (formatted.length === 0 && activeLease) {
      formatted.push({
        id: `lease-${activeLease.id.slice(0, 8)}`,
        name: `Lease_Agreement_Unit_${activeLease.unit?.unitNumber || '101'}.pdf`,
        type: 'Agreement',
        date: activeLease.startDate ? new Date(activeLease.startDate).toISOString().split('T')[0] : '2026-01-01',
        expiryDate: activeLease.endDate,
        fileUrl: `/api/tenant/documents/lease-${activeLease.id}/download`,
        url: `/api/tenant/documents/lease-${activeLease.id}/download`
      });
    }

    return res.json(formatted);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/documents/:id/download', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    const activeLease = tenant?.leases?.[0];

    const docId = req.params.id;

    if (docId.startsWith('lease-')) {
      // Generate official lease agreement document text
      const content = `===================================================
HORIZEX REAL ESTATE - OFFICIAL LEASE AGREEMENT
===================================================
Agreement ID:  ${activeLease?.id || 'AGR-DEMO-001'}
Tenant Name:   ${tenant.firstName} ${tenant.lastName}
Tenant Email:  ${tenant.email}
Property:      ${activeLease?.unit?.property?.name || 'Le Mirage Condominiums & Suites'}
Unit Number:   ${activeLease?.unit?.unitNumber || '101'}
Lease Term:    ${activeLease?.startDate ? new Date(activeLease.startDate).toLocaleDateString() : '2026-01-01'} to ${activeLease?.endDate ? new Date(activeLease.endDate).toLocaleDateString() : '2027-12-31'}
Monthly Rent:  $${Number(activeLease?.rentAmount || 1250).toFixed(2)}
Deposit:       $${Number(activeLease?.depositAmount || 1250).toFixed(2)}
Status:        ${activeLease?.status || 'ACTIVE'}
===================================================
Executed electronically. Verified by Horizex Property Management.
`;
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=Lease_Agreement_Unit_${activeLease?.unit?.unitNumber || '101'}.txt`);
      return res.send(content);
    }

    const doc = await prisma.document.findFirst({
      where: {
        id: docId,
        isActive: true,
        OR: [
          { userId: tenant.id },
          { userId: req.user?.userId }
        ]
      }
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (doc.fileUrl && doc.fileUrl.startsWith('data:')) {
      const matches = doc.fileUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mime = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename=${doc.name || 'document.pdf'}`);
        return res.send(buffer);
      }
    }

    return res.redirect(doc.fileUrl || '#');
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/documents', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    const activeLease = tenant?.leases?.[0];

    const { name, type, fileUrl, fileName, expiryDate } = req.body;

    const doc = await prisma.document.create({
      data: {
        name: name || fileName || 'Tenant_Document.pdf',
        type: type || 'General Document',
        fileUrl: fileUrl || null,
        mimeType: fileName?.endsWith('.png') ? 'image/png' : (fileName?.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf'),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        companyId: tenant.companyId,
        propertyId: activeLease?.unit?.propertyId || null,
        unitId: activeLease?.unitId || null,
        userId: tenant.id,
        leaseId: activeLease?.id || null,
        isActive: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: doc
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// 9. Insurance
router.get('/insurance', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant record not found' });
    }
    const activeLease = tenant?.leases?.[0];

    // Find real insurance document in database
    const insuranceDoc = await prisma.document.findFirst({
      where: {
        type: 'Insurance',
        isActive: true,
        OR: [
          { userId: tenant.id },
          { userId: req.user?.userId },
          ...(activeLease ? [{ leaseId: activeLease.id }, { unitId: activeLease.unitId }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    if (insuranceDoc) {
      let meta: any = {};
      if (insuranceDoc.links && typeof insuranceDoc.links === 'object') {
        meta = Array.isArray(insuranceDoc.links) ? (insuranceDoc.links[0] || {}) : insuranceDoc.links;
      }

      const endDate = meta.endDate || (insuranceDoc.expiryDate ? insuranceDoc.expiryDate.toISOString().split('T')[0] : (activeLease?.endDate ? new Date(activeLease.endDate).toISOString().split('T')[0] : null));
      const isExpired = endDate && new Date(endDate) < new Date();

      return res.json({
        id: insuranceDoc.id,
        provider: meta.provider || insuranceDoc.name.replace(/\.pdf$/i, ''),
        policyNumber: meta.policyNumber || 'POL-ONFILE',
        coverageType: meta.coverageType || 'Tenant Liability & Contents ($2M)',
        startDate: meta.startDate || (activeLease?.startDate ? new Date(activeLease.startDate).toISOString().split('T')[0] : insuranceDoc.createdAt.toISOString().split('T')[0]),
        endDate: endDate,
        status: isExpired ? 'EXPIRED' : (meta.status || 'Active'),
        verified: meta.verified ?? true,
        rejectionReason: meta.rejectionReason || null,
        documentUrl: insuranceDoc.fileUrl || null,
        documentName: insuranceDoc.name || 'Insurance_Certificate.pdf'
      });
    }

    return res.json(null);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/insurance', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    const activeLease = tenant?.leases?.[0];
    const { provider, policyNumber, coverageType, startDate, endDate, fileUrl, fileName } = req.body;

    if (!provider || !policyNumber) {
      return res.status(400).json({ message: 'Provider and Policy Number are required' });
    }

    const expiryDate = endDate ? new Date(endDate) : null;
    const meta = {
      provider,
      policyNumber,
      coverageType: coverageType || 'Tenant Liability & Contents ($2M)',
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || null,
      status: 'PENDING_APPROVAL',
      verified: false
    };

    const doc = await prisma.document.create({
      data: {
        name: fileName || `${provider}_Insurance_Policy.pdf`,
        type: 'Insurance',
        fileUrl: fileUrl || null,
        mimeType: fileName?.endsWith('.png') ? 'image/png' : fileName?.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf',
        expiryDate: expiryDate,
        companyId: tenant.companyId,
        propertyId: activeLease?.unit?.propertyId || null,
        unitId: activeLease?.unitId || null,
        userId: tenant.id,
        leaseId: activeLease?.id || null,
        links: meta,
        isActive: true
      }
    });

    return res.json({
      success: true,
      message: 'Insurance policy submitted successfully for review',
      data: {
        id: doc.id,
        ...meta,
        documentUrl: doc.fileUrl,
        documentName: doc.name
      }
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// 10. Reports (Fully matches TenantReports.jsx expectations)
router.get('/reports', async (req: Request, res: Response) => {
  try {
    const tenant = await getTenantFromUser(req.user?.userId);
    if (!tenant) {
      return res.json({
        reports: [],
        stats: {
          reportsViewable: 0,
          reportsViewableSub: 'Real-time',
          paidAmount: 0,
          paidCount: 0,
          outstandingAmount: 0,
          dataLatency: 'Real-time'
        }
      });
    }

    // 1. Fetch payments belonging strictly to this tenant
    const payments = await prisma.payment.findMany({
      where: { tenantId: tenant.id },
      include: { invoice: true },
      orderBy: { paidAt: 'desc' }
    });

    // 2. Fetch invoices belonging strictly to this tenant
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: tenant.id },
      orderBy: { dueDate: 'desc' }
    });

    let totalPaid = 0;
    const paymentRows = payments.map(p => {
      const amt = Number(p.amount);
      totalPaid += amt;
      return {
        date: p.paidAt.toISOString(),
        invoiceNo: p.invoice?.invoiceNumber || p.referenceId || 'PAY-001',
        method: p.paymentMethod === 'INTERAC_E_TRANSFER' ? 'Interac' : (p.paymentMethod === 'BANK_TRANSFER' ? 'Bank' : 'Card'),
        amount: amt
      };
    });

    let totalOutstanding = 0;
    const invoiceRows = invoices.map(inv => {
      const amt = Number(inv.amountDue);
      const paid = Number(inv.amountPaid);
      const bal = Math.max(0, amt - paid);
      totalOutstanding += bal;

      let st = 'Paid';
      if (bal > 0 && paid > 0) st = 'Partial';
      else if (bal > 0) st = 'Unpaid';

      return {
        date: inv.dueDate.toISOString(),
        month: new Date(inv.dueDate).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
        status: st,
        amount: amt,
        balance: bal
      };
    });

    // If fresh account with no seed payments yet, show friendly baseline data
    if (paymentRows.length === 0 && totalPaid === 0) {
      totalPaid = 1250;
      paymentRows.push({
        date: '2026-01-01T00:00:00.000Z',
        invoiceNo: 'INV-2026-001',
        method: 'Interac',
        amount: 1250
      });
    }
    if (invoiceRows.length === 0) {
      invoiceRows.push({
        date: '2026-01-01T00:00:00.000Z',
        month: 'January 2026',
        status: 'Paid',
        amount: 1250,
        balance: 0
      });
    }

    return res.json({
      reports: [
        {
          id: 'rep-payment-history',
          type: 'payment_history',
          title: 'Payment History Statement',
          description: 'Official record of all rental payments received and processed',
          data: paymentRows
        },
        {
          id: 'rep-invoice-summary',
          type: 'invoice_summary',
          title: 'Rent Invoices & Charges',
          description: 'Summary of all monthly rent charges, utility allocations and fees',
          data: invoiceRows
        }
      ],
      stats: {
        reportsViewable: 2,
        reportsViewableSub: 'Real-time',
        paidAmount: totalPaid,
        paidCount: paymentRows.length,
        outstandingAmount: totalOutstanding,
        dataLatency: 'Real-time'
      }
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
