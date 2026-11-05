import { Router, Request, Response } from 'express';
import { prisma } from '../../config/db';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

// Profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { firstName: true, lastName: true, email: true, phone: true }
    });
    return res.json({
      name: user ? `${user.firstName} ${user.lastName}`.trim() : 'Demo Owner',
      email: user?.email || '',
      phone: user?.phone || '+1 (514) 555-0192'
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Dashboard stats
router.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const totalProperties = await prisma.property.count({ where: { isActive: true } });
    const totalUnits = await prisma.unit.count({ where: { isActive: true } });
    const occupiedUnits = await prisma.unit.count({ where: { isActive: true, status: 'OCCUPIED' } });
    const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : 85.0;

    const activeLeases = await prisma.lease.findMany({
      where: { isActive: true },
      include: {
        tenant: true,
        unit: { include: { property: true } }
      },
      take: 6
    });

    const tenantsList = activeLeases.map(l => ({
      name: `${l.tenant.firstName} ${l.tenant.lastName}`.trim(),
      email: l.tenant.email,
      property: l.unit.property?.name || 'Property',
      unit: l.unit.unitNumber || '101'
    }));

    return res.json({
      propertyCount: totalProperties,
      totalProperties,
      unitCount: totalUnits,
      totalUnits,
      occupiedUnits,
      monthlyRevenue: 15400,
      occupancyRate,
      occupancy: {
        vacantUnits,
        vacantUnitsList: [],
        vacantBedrooms: 0,
        vacantBedroomsList: []
      },
      outstandingDues: 0,
      insuranceExpiryCount: 0,
      recentActivity: [],
      tenants: tenantsList
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Financial Pulse (returns array of monthly records expected by OwnerDashboard)
router.get('/dashboard/financial-pulse', async (req: Request, res: Response) => {
  try {
    return res.json([
      { month: 'November 2025', expected: 15400, collected: 15400, dues: 0 },
      { month: 'December 2025', expected: 15400, collected: 15400, dues: 0 },
      { month: 'January 2026', expected: 15400, collected: 15400, dues: 0 },
      { month: 'February 2026', expected: 15400, collected: 15400, dues: 0 }
    ]);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Financials Overview
router.get('/financials', async (req: Request, res: Response) => {
  try {
    return res.json({
      collected: 15400,
      outstandingDues: 0,
      securityDepositsHeld: 2500,
      netEarnings: 14200,
      transactions: []
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Properties
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const properties = await prisma.property.findMany({
      where: { isActive: true },
      include: {
        units: { where: { isActive: true } }
      }
    });

    const mapped = properties.map(p => {
      const totalU = p.units.length;
      const occU = p.units.filter(u => u.status === 'OCCUPIED').length;
      const rate = totalU > 0 ? Math.round((occU / totalU) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
        units: totalU || p.totalUnits,
        occupancy: rate,
        status: p.isActive ? 'Active' : 'Inactive'
      };
    });

    return res.json(mapped);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Reports & Chat
router.get('/reports', (req, res) => res.json({ reports: [] }));
router.get('/communication', (req, res) => res.json([]));

export default router;
