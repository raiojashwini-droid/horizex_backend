import { prisma } from '../../config/db';

export class AnalyticsService {
  static async getDashboardStats(companyId?: string | null, propertyId?: string | null) {
    const propertyWhere: any = { isActive: true };
    const unitWhere: any = { isActive: true };
    const ticketWhere: any = { status: { notIn: ['CLOSED', 'RESOLVED'] } };
    const leaseWhere: any = { status: 'ACTIVE', isActive: true };
    const invoiceWhere: any = {};
    const paymentWhere: any = { status: 'COMPLETED' };

    if (companyId && companyId !== 'all') {
      propertyWhere.companyId = companyId;
      unitWhere.property = { companyId };
      ticketWhere.property = { companyId };
      leaseWhere.unit = { property: { companyId } };
      invoiceWhere.tenant = { companyId };
      paymentWhere.tenant = { companyId };
    }

    if (propertyId && propertyId !== 'all') {
      propertyWhere.id = propertyId;
      unitWhere.propertyId = propertyId;
      ticketWhere.propertyId = propertyId;
      leaseWhere.unit = { propertyId };
      invoiceWhere.lease = { unit: { propertyId } };
      paymentWhere.invoice = { lease: { unit: { propertyId } } };
    }

    const [totalProperties, totalUnits, occupiedUnits, vacantUnits, turnoverUnits, openTickets, emergencyTickets] =
      await Promise.all([
        prisma.property.count({ where: propertyWhere }),
        prisma.unit.count({ where: unitWhere }),
        prisma.unit.count({ where: { ...unitWhere, status: 'OCCUPIED' } }),
        prisma.unit.count({ where: { ...unitWhere, status: 'VACANT' } }),
        prisma.unit.count({ where: { ...unitWhere, status: 'TURNOVER' } }),
        prisma.maintenanceTicket.count({ where: ticketWhere }),
        prisma.maintenanceTicket.count({ where: { ...ticketWhere, priority: 'EMERGENCY' } }),
      ]);

    // Financial totals for current month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    const monthlyInvoices = await prisma.invoice.findMany({
      where: {
        ...invoiceWhere,
        dueDate: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { amountDue: true, amountPaid: true },
    });

    const totalBilledThisMonth = monthlyInvoices.reduce((acc, curr) => acc + Number(curr.amountDue), 0);
    const totalCollectedThisMonth = monthlyInvoices.reduce((acc, curr) => acc + Number(curr.amountPaid), 0);

    // Leases expiring within 30 and 60 days
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);
    const in60Days = new Date();
    in60Days.setDate(now.getDate() + 60);

    const [expiring30Days, expiring60Days, recentPayments, recentLeases, recentTickets] = await Promise.all([
      prisma.lease.count({
        where: {
          ...leaseWhere,
          endDate: { gte: now, lte: in30Days },
        },
      }),
      prisma.lease.count({
        where: {
          ...leaseWhere,
          endDate: { gte: now, lte: in60Days },
        },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        include: {
          tenant: { select: { firstName: true, lastName: true } },
          invoice: {
            include: {
              lease: {
                include: {
                  unit: {
                    include: { property: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
        take: 5,
      }),
      prisma.lease.findMany({
        where: leaseWhere,
        include: {
          tenant: { select: { firstName: true, lastName: true } },
          unit: { include: { property: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.maintenanceTicket.findMany({
        where: ticketWhere,
        include: {
          property: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const recentActivity: string[] = [];
    recentPayments.forEach((p) => {
      const propName = p.invoice?.lease?.unit?.property?.name || 'Property';
      const tenantName = p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}`.trim() : 'Tenant';
      recentActivity.push(`Payment of $${(Number(p.amount) || 0).toLocaleString('en-CA')} received from ${tenantName} for ${propName}`);
    });
    recentLeases.forEach((l) => {
      const propName = l.unit?.property?.name || 'Property';
      const tenantName = l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}`.trim() : 'Tenant';
      recentActivity.push(`Lease agreement active for ${tenantName} at ${propName}`);
    });
    recentTickets.forEach((t) => {
      const propName = t.property?.name || 'Property';
      recentActivity.push(`Maintenance ticket: ${t.title || 'Service request'} created for ${propName}`);
    });

    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
    const vacancyRate = totalUnits > 0 ? (vacantUnits / totalUnits) * 100 : 0;

    return {
      portfolio: {
        totalProperties,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        turnoverUnits,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        vacancyRate: Math.round(vacancyRate * 10) / 10,
      },
      financials: {
        totalBilledThisMonth: Math.round(totalBilledThisMonth * 100) / 100,
        totalCollectedThisMonth: Math.round(totalCollectedThisMonth * 100) / 100,
        collectionRate:
          totalBilledThisMonth > 0
            ? Math.round((totalCollectedThisMonth / totalBilledThisMonth) * 1000) / 10
            : 0,
      },
      alerts: {
        expiring30Days,
        expiring60Days,
        openTickets,
        emergencyTickets,
      },
      recentActivity: recentActivity.slice(0, 8),
    };
  }

  static async getRevenueTrajectory(companyId?: string | null, propertyId?: string | null) {
    const where: any = {};
    if (companyId && companyId !== 'all') {
      where.tenant = { companyId };
    }
    if (propertyId && propertyId !== 'all') {
      where.invoice = {
        lease: {
          unit: {
            propertyId,
          },
        },
      };
    }

    // Fetch payments in last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const payments = await prisma.payment.findMany({
      where: {
        ...where,
        paidAt: { gte: sixMonthsAgo },
        status: 'COMPLETED',
      },
      include: {
        invoice: {
          include: {
            lease: {
              include: {
                unit: {
                  select: { propertyId: true },
                },
              },
            },
          },
        },
      },
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyRevenueMap: Record<string, number> = {};
    const monthsList: string[] = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      monthlyRevenueMap[key] = 0;
      monthsList.push(key);
    }

    for (const p of payments) {
      const pDate = new Date(p.paidAt);
      const key = `${months[pDate.getMonth()]} ${pDate.getFullYear()}`;
      if (monthlyRevenueMap[key] !== undefined) {
        monthlyRevenueMap[key] += Number(p.amount);
      }
    }

    const monthlyRevenue = Object.entries(monthlyRevenueMap).map(([month, revenue]) => ({
      month,
      revenue: Math.round(revenue * 100) / 100,
      amount: Math.round(revenue * 100) / 100,
      rent: Math.round(revenue * 100) / 100,
      deposit: 0,
      serviceFees: 0,
    }));

    const propWhere: any = { isActive: true };
    if (companyId && companyId !== 'all') propWhere.companyId = companyId;
    if (propertyId && propertyId !== 'all') propWhere.id = propertyId;
    const properties = await prisma.property.findMany({
      where: propWhere,
      select: { id: true, name: true },
    });

    // Real property revenue aggregation
    const revenueByProperty = properties.map((prop) => {
      let propTotal = 0;
      const propMonthlyMap: Record<string, number> = {};
      monthsList.forEach((m) => {
        propMonthlyMap[m] = 0;
      });

      payments.forEach((p) => {
        const pPropId = p.invoice?.lease?.unit?.propertyId;
        if (pPropId === prop.id) {
          const amt = Number(p.amount) || 0;
          propTotal += amt;
          const pDate = new Date(p.paidAt);
          const mKey = `${months[pDate.getMonth()]} ${pDate.getFullYear()}`;
          if (propMonthlyMap[mKey] !== undefined) {
            propMonthlyMap[mKey] += amt;
          }
        }
      });

      return {
        id: prop.id,
        name: prop.name,
        amount: Math.round(propTotal * 100) / 100,
        rent: Math.round(propTotal * 100) / 100,
        deposit: 0,
        serviceFees: 0,
        monthly: Object.entries(propMonthlyMap).map(([month, val]) => ({
          month,
          amount: Math.round(val * 100) / 100,
          rent: Math.round(val * 100) / 100,
          deposit: 0,
          serviceFees: 0,
        })),
      };
    });

    // Calculate real security deposits from active leases
    const leaseWhere: any = { status: 'ACTIVE', isActive: true };
    if (companyId && companyId !== 'all') leaseWhere.unit = { property: { companyId } };
    if (propertyId && propertyId !== 'all') {
      leaseWhere.unit = { ...(leaseWhere.unit || {}), propertyId };
    }

    const activeLeases = await prisma.lease.findMany({
      where: leaseWhere,
      select: { depositAmount: true },
    });
    const totalDeposit = activeLeases.reduce((acc, l) => acc + (Number(l.depositAmount) || 0), 0);

    const totalRevenue = monthlyRevenue.reduce((acc, curr) => acc + curr.revenue, 0);

    return {
      actualRevenue: totalRevenue,
      actualRent: totalRevenue,
      actualDeposit: totalDeposit,
      actualServiceFees: 0,
      projectedRevenue: totalRevenue,
      totalRevenue,
      monthlyRevenue,
      revenueByProperty,
    };
  }

  static async getVacancyAnalytics(companyId?: string | null) {
    const where: any = { isActive: true };
    if (companyId) {
      where.companyId = companyId;
    }

    const properties = await prisma.property.findMany({
      where,
      include: {
        units: {
          where: { isActive: true },
          include: {
            unitType: true,
          },
        },
      },
    });

    let total = 0;
    let vacant = 0;
    let occupied = 0;
    const vacancyByBuilding: any[] = [];
    const vacantUnitsList: any[] = [];

    for (const prop of properties) {
      const propTotal = prop.units.length;
      const propVacant = prop.units.filter((u) => u.status === 'VACANT' || u.status === 'TURNOVER').length;
      const propOccupied = propTotal - propVacant;

      total += propTotal;
      vacant += propVacant;
      occupied += propOccupied;

      vacancyByBuilding.push({
        name: prop.name,
        total: propTotal,
        occupied: propOccupied,
        vacant: propVacant,
        hasBedroomWise: false,
      });

      for (const u of prop.units) {
        if (u.status === 'VACANT' || u.status === 'TURNOVER') {
          vacantUnitsList.push({
            id: u.id,
            unitNumber: u.unitNumber,
            building: prop.name,
            rent: Number(u.baseRent),
            listingAgent: 'Horizex Leasing',
            rentalStatus: u.status === 'VACANT' ? 'Ready to rent out' : 'Under renovations',
            listingStatus: 'Already listed',
            parking: 'Yes',
          });
        }
      }
    }

    return {
      total,
      vacant,
      occupied,
      totalVacantBedrooms: 0,
      fullUnitCount: total,
      bedroomWiseCount: 0,
      willBeVacant: 0,
      upcomingVacancies: [],
      vacancyByBuilding,
      vacantUnitsList,
    };
  }
}

