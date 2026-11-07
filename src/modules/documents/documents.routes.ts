import { Router } from 'express';
import {
  getDocuments,
  uploadDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
  downloadProof
} from './documents.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// Allow token passed in query parameter for download links opened in new tabs / windows
router.use((req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});

router.use(authenticate);

// Public/Proof downloads
router.get('/download-proof', downloadProof);
router.get('/:id/download', downloadDocument);

// Document CRUD
router.get('/', getDocuments);
router.post('/upload', uploadDocument);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

export default router;

