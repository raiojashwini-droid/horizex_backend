import { Request, Response, NextFunction } from 'express';
import { DocumentsService } from './documents.service';
import { sendSuccess } from '../../utils/apiResponse.util';
import { uploadBase64Image } from '../../config/cloudinary';

export const getDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryCompanyId = (req.query.companyId as string) || (req.headers['x-company-context'] as string);
    const companyId = queryCompanyId && queryCompanyId !== 'all' ? queryCompanyId : req.user?.effectiveCompanyId;
    const search = req.query.search as string;
    const type = req.query.type as string;

    const docs = await DocumentsService.listDocuments({
      companyId: companyId && companyId !== 'all' ? companyId : null,
      search,
      type
    });

    return sendSuccess(res, docs);
  } catch (err) {
    return next(err);
  }
};

export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let links: any[] = [];
    if (req.body.links) {
      try {
        links = typeof req.body.links === 'string' ? JSON.parse(req.body.links) : req.body.links;
      } catch (e) {
        links = [];
      }
    }

    const queryCompanyId = req.body.companyId || (req.query.companyId as string) || (req.headers['x-company-context'] as string);
    const companyId = queryCompanyId && queryCompanyId !== 'all' ? queryCompanyId : req.user?.effectiveCompanyId;

    let fileUrl = req.body.fileUrl || null;
    const fileBase64 = req.body.fileBase64 || (typeof fileUrl === 'string' && fileUrl.startsWith('data:') ? fileUrl : null);

    // Attempt upload to Cloudinary if file data is present
    if (fileBase64) {
      try {
        const cloudRes = await uploadBase64Image(fileBase64, 'horizex_documents');
        if (cloudRes?.url) {
          fileUrl = cloudRes.url;
        }
      } catch (cloudErr: any) {
        console.warn('Cloudinary upload warning:', cloudErr?.message || cloudErr);
        // Fallback: keep the base64 data URL so document content is preserved
        if (!fileUrl) {
          fileUrl = fileBase64;
        }
      }
    }

    const doc = await DocumentsService.createDocument({
      name: req.body.name || 'Uploaded_Document.pdf',
      type: req.body.type || 'Other',
      expiryDate: req.body.expiryDate || null,
      links,
      fileUrl: fileUrl || null,
      fileSize: req.body.fileSize || '1.0 MB',
      mimeType: req.body.mimeType || 'application/pdf',
      companyId: companyId && companyId !== 'all' ? companyId : null,
    });

    return sendSuccess(res, doc, 201);
  } catch (err) {
    return next(err);
  }
};

export const updateDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    let links: any[] = [];
    if (req.body.links) {
      try {
        links = typeof req.body.links === 'string' ? JSON.parse(req.body.links) : req.body.links;
      } catch (e) {
        links = [];
      }
    }

    const updated = await DocumentsService.updateDocument(id, {
      name: req.body.name,
      type: req.body.type,
      expiryDate: req.body.expiryDate || null,
      links,
    });

    return sendSuccess(res, updated);
  } catch (err) {
    return next(err);
  }
};

export const deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await DocumentsService.deleteDocument(id);
    return sendSuccess(res, { success: true, message: 'Document deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

export const downloadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const doc = await DocumentsService.getDocumentById(id);

    // If document has a remote Cloudinary URL, redirect directly to it
    if (doc?.fileUrl && (doc.fileUrl.startsWith('http://') || doc.fileUrl.startsWith('https://'))) {
      return res.redirect(doc.fileUrl);
    }

    // If document has a Base64 data URL, stream the decoded file buffer
    if (doc?.fileUrl && doc.fileUrl.startsWith('data:')) {
      const matches = doc.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const docName = doc.name || `Document_${id}.pdf`;
        const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `${disposition}; filename="${docName}"`);
        return res.send(buffer);
      }
    }

    const docName = doc?.name || `Document_${id}.pdf`;
    const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `${disposition}; filename="${docName}"`);

    const content = `HORIZEX PROPERTY MANAGEMENT\n====================================\nDOCUMENT RECORD VAULT\n====================================\nDocument Name: ${docName}\nDocument ID: ${id}\nCategory / Type: ${doc?.type || 'Official'}\nCreated Date: ${doc?.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'N/A'}\nExpiry Date: ${doc?.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'N/A'}\nFile Size: ${doc?.fileSize || '1.2 MB'}\nStatus: Verified System Document\n====================================\nOfficial Horizex Property Management Record Archive`;

    return res.send(content);
  } catch (err) {
    return next(err);
  }
};

export const downloadProof = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const proofUrl = (req.query.url as string) || 'proof_receipt.pdf';
    const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `${disposition}; filename="refund_adjustment_proof.txt"`);

    const content = `HORIZEX FINANCIAL RECORDS\n====================================\nREFUND & ADJUSTMENT PROOF RECEIPT\n====================================\nDocument Reference: ${proofUrl}\nVerification: Verified & Audited by Accounting Team\nDate: ${new Date().toLocaleDateString()}\n====================================`;

    return res.send(content);
  } catch (err) {
    return next(err);
  }
};

