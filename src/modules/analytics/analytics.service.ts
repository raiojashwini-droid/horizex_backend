import { prisma } from '../../config/db';

export class AnalyticsService {
  static async getDashboardStats(companyId?: string | null) {
    const propertyWhere: any = { isActive: true };
    const unitWhere: any = { isActive: true };
    const ticketWhere: any = { status: { notIn: ['CLOSED', 'RESOLVED'] } };
    const leaseWhere: any = { status: 'ACTIVE', isActive: true };
    const invoiceWhere: any = {};

    if (companyId) {
      propertyWhere.companyId = companyId;
      unitWhere.property = { companyId };
      ticketWhere.property = { companyId };
      leaseWhere.unit = { property: { companyId } };
      invoiceWhere.tenant = { companyId };
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

    const [expiring30Days, expiring60Days] = await Promise.all([
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
    ]);

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
    };
  }

  static async getRevenueTrajectory(companyId?: string | null) {
    const where: any = {};
    if (companyId) {
      where.tenant = { companyId };
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
      select: { amount: true, paidAt: true },
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyRevenueMap: Record<string, number> = {};

    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      monthlyRevenueMap[key] = 0;
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
    if (companyId) propWhere.companyId = companyId;
    const properties = await prisma.property.findMany({
      where: propWhere,
      select: { id: true, name: true },
    });

    const revenueByProperty = properties.map((p) => ({
      id: p.id,
      name: p.name,
      amount: 0,
      rent: 0,
      deposit: 0,
      serviceFees: 0,
      monthly: monthlyRevenue.map((m) => ({ ...m, amount: 0, rent: 0, deposit: 0, serviceFees: 0 })),
    }));

    const totalRevenue = monthlyRevenue.reduce((acc, curr) => acc + curr.revenue, 0);

    return {
      actualRevenue: totalRevenue,
      actualRent: totalRevenue,
      actualDeposit: 0,
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

