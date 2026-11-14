import { Router, Request, Response } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorizeRoles } from '../../middlewares/rbac.middleware';

const router = Router();
router.use(authenticate);

// Initial store for rental applications
let applicationsStore = [
  {
    id: 'APP-1001',
    applicantName: 'Alexandre Tremblay',
    unitAddress: 'Parkview Heights - Apt 304',
    listingAgent: 'Sarah Jenkins',
    appliedDate: '2026-10-26',
    status: 'UNDER_REVIEW',
    creditScore: {
      value: '745 (Equifax)',
      isVerified: true,
      notes: 'Excellent credit standing. 0 late payments in past 36 months.'
    },
    employment: {
      company: 'Deloitte Canada',
      role: 'Senior Financial Analyst',
      isVerified: true,
      notes: 'Full-time permanent position. Tenure 3.5 years.'
    },
    salary: {
      amount: '$88,000 / year ($7,333/mo)',
      isVerified: true,
      notes: 'Reviewed past 3 paystubs. Rent-to-income ratio is 24%.'
    },
    landlordReference: {
      contact: 'Marc Tremblay - (514) 555-0192',
      isVerified: true,
      notes: 'Spoke with previous landlord. Tenant paid on time and left unit spotless.'
    },
    employerReference: {
      contact: 'Valerie Fortin (HR Director) - v.fortin@deloitte.com',
      isVerified: true,
      notes: 'HR confirmed employment, salary, and good standing.'
    },
    talAddress: {
      address: '4210 Rue Saint-Denis, Montreal, QC',
      isVerified: true,
      notes: 'TAL registry search confirmed no historical non-payment or disturbance cases.'
    },
    judgementsOnName: {
      details: 'Zero judgements found',
      isVerified: true,
      notes: 'Tribunal administratif du logement check: Clean record on applicant name.'
    },
    pets: {
      details: '1 Domestic Shorthair Cat (10 lbs, neutered)',
      isVerified: true,
      notes: 'Complies with building pet policy. Vaccination certificate provided.'
    },
    otherNotes: 'Strong applicant with solid references and verified income. Recommended for lease execution.'
  },
  {
    id: 'APP-1002',
    applicantName: 'Sophia Patel',
    unitAddress: 'Downtown Executive Suites - Apt 102',
    listingAgent: 'Michael Chang',
    appliedDate: '2026-10-27',
    status: 'PENDING',
    creditScore: {
      value: '690 (TransUnion)',
      isVerified: false,
      notes: 'Pending credit bureau soft pull confirmation.'
    },
    employment: {
      company: 'Shopify Corp',
      role: 'Product Designer',
      isVerified: true,
      notes: 'Remote employee confirmed via Shopify internal portal verification.'
    },
    salary: {
      amount: '$95,000 / year ($7,916/mo)',
      isVerified: false,
      notes: 'Waiting for official T4 tax slip from applicant.'
    },
    landlordReference: {
      contact: 'Elite Living Mgmt - (514) 555-8831',
      isVerified: false,
      notes: 'Left voicemail with property manager, awaiting callback.'
    },
    employerReference: {
      contact: 'David Ross (Team Lead) - david.r@shopify.com',
      isVerified: true,
      notes: 'Manager provided excellent character reference.'
    },
    talAddress: {
      address: '1240 Rue Peel, Apt 6B, Montreal, QC',
      isVerified: false,
      notes: 'Need to run address verification against TAL case records.'
    },
    judgementsOnName: {
      details: 'Check in progress',
      isVerified: false,
      notes: 'Awaiting court registry cross-reference results.'
    },
    pets: {
      details: 'None declared',
      isVerified: true,
      notes: 'Applicant confirmed no pets.'
    },
    otherNotes: 'Awaiting landlord callback and T4 verification before final approval.'
  },
  {
    id: 'APP-1003',
    applicantName: 'Marcus Vance',
    unitAddress: 'Soros Capital Residences - Apt 508',
    listingAgent: 'Sarah Jenkins',
    appliedDate: '2026-10-24',
    status: 'APPROVED',
    creditScore: {
      value: '780 (Equifax)',
      isVerified: true,
      notes: 'Superb credit score with clean trade lines.'
    },
    employment: {
      company: 'Bombardier Aviation',
      role: 'Quality Assurance Lead',
      isVerified: true,
      notes: 'Permanent position since 2019.'
    },
    salary: {
      amount: '$104,000 / year ($8,666/mo)',
      isVerified: true,
      notes: 'Verified via 2025 Notice of Assessment and direct deposit stubs.'
    },
    landlordReference: {
      contact: 'Jean-Luc Picard - (514) 555-7744',
      isVerified: true,
      notes: 'Previous landlord of 4 years confirmed exemplary tenancy.'
    },
    employerReference: {
      contact: 'HR Verification Desk - hr@bombardier.ca',
      isVerified: true,
      notes: 'Official employment verification letter on file.'
    },
    talAddress: {
      address: '5800 Boulevard Decarie, Montreal, QC',
      isVerified: true,
      notes: 'Clean address history with zero TAL tribunal hearings.'
    },
    judgementsOnName: {
      details: 'No record found (Clean)',
      isVerified: true,
      notes: 'No Quebec or Federal civil court judgements.'
    },
    pets: {
      details: '1 Golden Retriever (certified service animal)',
      isVerified: true,
      notes: 'Medical documentation and vaccination up to date.'
    },
    otherNotes: 'Fully approved. Lease draft sent for digital signature.'
  }
];

// GET /api/admin/rental-applications
router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  async (req: Request, res: Response) => {
    return res.json({
      success: true,
      data: applicationsStore,
    });
  }
);

// POST /api/admin/rental-applications
router.post(
  '/',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const newApp = {
        ...body,
        id: body.id || `APP-${Math.floor(1000 + Math.random() * 9000)}`,
        appliedDate: body.appliedDate || new Date().toISOString().split('T')[0],
        status: body.status || 'PENDING',
      };

      // Unshift so new application appears at top
      applicationsStore.unshift(newApp);

      return res.status(201).json({
        success: true,
        message: 'Rental application created successfully',
        data: newApp,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/admin/rental-applications/:id
router.put(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const index = applicationsStore.findIndex((a) => a.id === id);

      if (index === -1) {
        // If not found, insert or create
        const newApp = { ...req.body, id };
        applicationsStore.unshift(newApp);
        return res.json({ success: true, data: newApp });
      }

      applicationsStore[index] = {
        ...applicationsStore[index],
        ...req.body,
        id, // ensure ID is preserved
      };

      return res.json({
        success: true,
        message: 'Rental application updated successfully',
        data: applicationsStore[index],
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/admin/rental-applications/:id
router.delete(
  '/:id',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'PROPERTY_MANAGER'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      applicationsStore = applicationsStore.filter((a) => a.id !== id);
      return res.json({
        success: true,
        message: 'Rental application deleted successfully',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;

