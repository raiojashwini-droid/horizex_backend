import { prisma } from '../../config/db';
import { AppError } from '../../middlewares/errorHandler';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';

export class EmployeesService {
  private static async ensureDefaultEmployees() {
    try {
      const count = await prisma.staffProfile.count();
      if (count > 0) return;

      const defaultEmps = [
        {
          employeeNo: 'EMP-APEX-2026-00004',
          companyId: '1',
          buildingId: '1',
          department: 'Operations',
          firstName: 'Sarah',
          lastName: 'Smith',
          email: 'sarah.smith@property.com',
          phone: '+1 (514) 555-0188',
          role: 'COWORKER',
          designation: 'Assistant Property Manager',
          employmentType: 'Full-time',
          shiftId: '1',
          salary: 4500,
          status: 'Active',
        },
        {
          employeeNo: 'EMP-APEX-2026-00005',
          companyId: '1',
          buildingId: '1',
          department: 'Maintenance',
          firstName: 'Mike',
          lastName: 'Johnson',
          email: 'mike.johnson@property.com',
          phone: '+1 (514) 555-0189',
          role: 'COWORKER',
          designation: 'Maintenance Supervisor',
          employmentType: 'Full-time',
          shiftId: '1',
          salary: 4200,
          status: 'Active',
        },
        {
          employeeNo: 'EMP-APEX-2026-00006',
          companyId: '1',
          buildingId: '1',
          department: 'Sales & Leasing',
          firstName: 'Sarah',
          lastName: 'Jenkins',
          email: 'sarah.jenkins@property.com',
          phone: '+1 (514) 555-0190',
          role: 'COWORKER',
          designation: 'Listing Agent',
          employmentType: 'Full-time',
          shiftId: '1',
          salary: 4800,
          status: 'Active',
        },
      ];

      for (const emp of defaultEmps) {
        await EmployeesService.createEmployee(emp);
      }
    } catch (err) {
      console.warn('Could not auto-seed default employees:', err);
    }
  }

  static async listEmployees(filters: any = {}) {
    await EmployeesService.ensureDefaultEmployees();

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { staffProfile: { isNot: null } },
          { notes: { some: { targetType: 'EMPLOYEE_META' } } },
          { role: { in: [Role.MAINTENANCE_STAFF, Role.PROPERTY_MANAGER, Role.ACCOUNTANT] } },
        ],
      },
      include: {
        staffProfile: true,
        notes: { where: { targetType: 'EMPLOYEE_META' } },
        company: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let mapped = users.map((u) => {
      let meta: any = {};
      if (u.notes && u.notes.length > 0) {
        try {
          meta = JSON.parse(u.notes[0].content);
        } catch {
          meta = {};
        }
      }

      return {
        id: u.id,
        employeeNo: meta.employeeNo || `EMP-APEX-2026-${u.id.slice(0, 5).toUpperCase()}`,
        companyId: meta.companyId !== undefined ? meta.companyId : (u.companyId || 1),
        buildingId: meta.buildingId !== undefined ? meta.buildingId : 1,
        department: meta.department || u.staffProfile?.department || 'Operations',
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone || meta.phone || '',
        role: 'COWORKER',
        designation: meta.designation || (u.staffProfile?.department === 'Maintenance' ? 'Maintenance Supervisor' : 'Specialist'),
        employmentType: meta.employmentType || 'Full-time',
        shiftId: meta.shiftId !== undefined ? meta.shiftId : 1,
        salary: meta.salary !== undefined ? Number(meta.salary) : (u.staffProfile?.hourlyRate ? Number(u.staffProfile.hourlyRate) * 160 : 3500),
        status: meta.status || (u.isActive ? 'Active' : 'Inactive'),
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        createdBy: meta.createdBy || 'Admin User',
        updatedBy: meta.updatedBy || 'Admin User',
      };
    });

    // Apply Filters
    if (filters.companyId) {
      mapped = mapped.filter((emp) => String(emp.companyId) === String(filters.companyId));
    }
    if (filters.buildingId) {
      mapped = mapped.filter((emp) => String(emp.buildingId) === String(filters.buildingId));
    }
    if (filters.department) {
      mapped = mapped.filter((emp) => emp.department === filters.department);
    }
    if (filters.shiftId) {
      mapped = mapped.filter((emp) => String(emp.shiftId) === String(filters.shiftId));
    }
    if (filters.status) {
      mapped = mapped.filter((emp) => emp.status.toLowerCase() === String(filters.status).toLowerCase());
    }
    if (filters.search) {
      const q = String(filters.search).toLowerCase();
      mapped = mapped.filter(
        (emp) =>
          `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
          emp.employeeNo.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          emp.designation.toLowerCase().includes(q)
      );
    }

    if (filters.sortBy) {
      const key = filters.sortBy as keyof typeof mapped[0];
      const desc = Boolean(filters.sortDesc);
      mapped.sort((a, b) => {
        const valA = String(a[key] ?? '').toLowerCase();
        const valB = String(b[key] ?? '').toLowerCase();
        if (valA < valB) return desc ? 1 : -1;
        if (valA > valB) return desc ? -1 : 1;
        return 0;
      });
    }

    return mapped;
  }

  static async getEmployeeById(id: string) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { notes: { some: { targetType: 'EMPLOYEE_META', content: { contains: id } } } },
        ],
      },
      include: {
        staffProfile: true,
        notes: { where: { targetType: 'EMPLOYEE_META' } },
        company: true,
      },
    });

    if (!user) {
      throw new AppError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
    }

    let meta: any = {};
    if (user.notes && user.notes.length > 0) {
      try {
        meta = JSON.parse(user.notes[0].content);
      } catch {
        meta = {};
      }
    }

    return {
      id: user.id,
      employeeNo: meta.employeeNo || `EMP-APEX-2026-${user.id.slice(0, 5).toUpperCase()}`,
      companyId: meta.companyId !== undefined ? meta.companyId : (user.companyId || 1),
      buildingId: meta.buildingId !== undefined ? meta.buildingId : 1,
      department: meta.department || user.staffProfile?.department || 'Operations',
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || meta.phone || '',
      role: 'COWORKER',
      designation: meta.designation || 'Specialist',
      employmentType: meta.employmentType || 'Full-time',
      shiftId: meta.shiftId !== undefined ? meta.shiftId : 1,
      salary: meta.salary !== undefined ? Number(meta.salary) : 3500,
      status: meta.status || (user.isActive ? 'Active' : 'Inactive'),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      createdBy: meta.createdBy || 'Admin User',
      updatedBy: meta.updatedBy || 'Admin User',
    };
  }

  static async createEmployee(data: any, actorUserId?: string) {
    const email = data.email?.trim().toLowerCase();
    if (!email) {
      throw new AppError('Email address is required', 400, 'EMAIL_REQUIRED');
    }

    // Resolve company
    let resolvedCompanyId: string | null = null;
    if (data.companyId && typeof data.companyId === 'string' && data.companyId.includes('-')) {
      const comp = await prisma.company.findUnique({ where: { id: data.companyId } });
      if (comp) resolvedCompanyId = comp.id;
    }
    if (!resolvedCompanyId) {
      const fallbackComp = await prisma.company.findFirst({ where: { isActive: true } });
      resolvedCompanyId = fallbackComp?.id || null;
    }

    // Determine Role
    const role =
      data.department?.toLowerCase() === 'maintenance'
        ? Role.MAINTENANCE_STAFF
        : data.department?.toLowerCase() === 'accounting'
        ? Role.ACCOUNTANT
        : Role.PROPERTY_MANAGER;

    const passwordHash = await bcrypt.hash('Employee@123', 10);

    // If a user with this email already exists, update their staff info
    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: data.firstName || user.firstName,
          lastName: data.lastName || user.lastName,
          phone: data.phone || user.phone,
          role,
          isActive: data.status !== 'Inactive',
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: data.firstName || 'New',
          lastName: data.lastName || 'Employee',
          phone: data.phone || null,
          role,
          companyId: resolvedCompanyId,
          isActive: data.status !== 'Inactive',
        },
      });
    }

    // Upsert StaffProfile
    const salary = Number(data.salary) || 3500;
    const hourlyRate = salary > 0 ? salary / 160 : 25;
    await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: {
        department: data.department || 'Operations',
        hourlyRate,
      },
      create: {
        userId: user.id,
        department: data.department || 'Operations',
        hourlyRate,
      },
    });

    // Generate Employee No if missing
    const seqCount = await prisma.staffProfile.count();
    const empNo =
      data.employeeNo || `EMP-APEX-2026-${String(seqCount + 10).padStart(5, '0')}`;

    const metaObj = {
      employeeNo: empNo,
      companyId: data.companyId !== undefined ? data.companyId : 1,
      buildingId: data.buildingId !== undefined ? data.buildingId : 1,
      department: data.department || 'Operations',
      designation: data.designation || 'Specialist',
      employmentType: data.employmentType || 'Full-time',
      shiftId: data.shiftId !== undefined ? data.shiftId : 1,
      salary,
      status: data.status || 'Active',
      createdBy: 'Admin User',
      updatedBy: 'Admin User',
    };

    // Save metadata Note
    const existingNote = await prisma.note.findFirst({
      where: { authorId: user.id, targetType: 'EMPLOYEE_META' },
    });

    if (existingNote) {
      await prisma.note.update({
        where: { id: existingNote.id },
        data: { content: JSON.stringify(metaObj) },
      });
    } else {
      await prisma.note.create({
        data: {
          authorId: user.id,
          targetType: 'EMPLOYEE_META',
          targetId: user.id,
          title: 'EMPLOYEE_DATA',
          content: JSON.stringify(metaObj),
        },
      });
    }

    return {
      id: user.id,
      employeeNo: empNo,
      companyId: metaObj.companyId,
      buildingId: metaObj.buildingId,
      department: metaObj.department,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      role: 'COWORKER',
      designation: metaObj.designation,
      employmentType: metaObj.employmentType,
      shiftId: metaObj.shiftId,
      salary: metaObj.salary,
      status: metaObj.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      createdBy: metaObj.createdBy,
      updatedBy: metaObj.updatedBy,
    };
  }

  static async updateEmployee(id: string, data: any, actorUserId?: string) {
    // Find employee user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { notes: { some: { targetType: 'EMPLOYEE_META', content: { contains: id } } } },
        ],
      },
      include: {
        staffProfile: true,
        notes: { where: { targetType: 'EMPLOYEE_META' } },
      },
    });

    if (!user) {
      throw new AppError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
    }

    // Update user fields
    const userData: any = {};
    if (data.firstName !== undefined) userData.firstName = data.firstName;
    if (data.lastName !== undefined) userData.lastName = data.lastName;
    if (data.email !== undefined) userData.email = data.email.trim().toLowerCase();
    if (data.phone !== undefined) userData.phone = data.phone;
    if (data.status !== undefined) userData.isActive = data.status !== 'Inactive';

    if (Object.keys(userData).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: userData,
        include: {
          staffProfile: true,
          notes: { where: { targetType: 'EMPLOYEE_META' } },
        },
      });
    }

    // Update StaffProfile
    const salary = data.salary !== undefined ? Number(data.salary) : undefined;
    const hourlyRate = salary !== undefined ? (salary > 0 ? salary / 160 : 0) : undefined;
    const staffData: any = {};
    if (data.department) staffData.department = data.department;
    if (hourlyRate !== undefined) staffData.hourlyRate = hourlyRate;

    if (Object.keys(staffData).length > 0) {
      await prisma.staffProfile.upsert({
        where: { userId: user.id },
        update: staffData,
        create: {
          userId: user.id,
          department: data.department || 'Operations',
          hourlyRate: hourlyRate || 25,
        },
      });
    }

    // Update metadata Note
    let currentMeta: any = {};
    const existingNote = user.notes && user.notes[0];
    if (existingNote) {
      try {
        currentMeta = JSON.parse(existingNote.content);
      } catch {
        currentMeta = {};
      }
    }

    const updatedMeta = {
      ...currentMeta,
      ...data,
      companyId: data.companyId !== undefined ? data.companyId : currentMeta.companyId,
      buildingId: data.buildingId !== undefined ? data.buildingId : currentMeta.buildingId,
      department: data.department !== undefined ? data.department : currentMeta.department,
      designation: data.designation !== undefined ? data.designation : currentMeta.designation,
      employmentType: data.employmentType !== undefined ? data.employmentType : currentMeta.employmentType,
      shiftId: data.shiftId !== undefined ? data.shiftId : currentMeta.shiftId,
      salary: salary !== undefined ? salary : currentMeta.salary,
      status: data.status !== undefined ? data.status : currentMeta.status,
      updatedBy: 'Admin User',
    };

    if (existingNote) {
      await prisma.note.update({
        where: { id: existingNote.id },
        data: { content: JSON.stringify(updatedMeta) },
      });
    } else {
      await prisma.note.create({
        data: {
          authorId: user.id,
          targetType: 'EMPLOYEE_META',
          targetId: user.id,
          title: 'EMPLOYEE_DATA',
          content: JSON.stringify(updatedMeta),
        },
      });
    }

    return {
      id: user.id,
      employeeNo: updatedMeta.employeeNo || `EMP-APEX-2026-${user.id.slice(0, 5).toUpperCase()}`,
      companyId: updatedMeta.companyId || 1,
      buildingId: updatedMeta.buildingId || 1,
      department: updatedMeta.department || 'Operations',
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      role: 'COWORKER',
      designation: updatedMeta.designation || 'Specialist',
      employmentType: updatedMeta.employmentType || 'Full-time',
      shiftId: updatedMeta.shiftId || 1,
      salary: updatedMeta.salary || 3500,
      status: updatedMeta.status || 'Active',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      createdBy: updatedMeta.createdBy || 'Admin User',
      updatedBy: updatedMeta.updatedBy || 'Admin User',
    };
  }

  static async deleteEmployee(id: string, actorUserId?: string) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { notes: { some: { targetType: 'EMPLOYEE_META', content: { contains: id } } } },
        ],
      },
    });

    if (!user) {
      return { success: true, message: 'Employee removed' };
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    return { success: true, message: 'Employee deleted successfully' };
  }
}

