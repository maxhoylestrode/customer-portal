import { Router } from 'express';
import {
  getTickets,
  createTicket,
  getTicket,
  updateTicket,
  deleteTicket,
  uploadAttachment,
  deleteAttachment,
} from '../controllers/ticketController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', getTickets);
router.post('/', upload.array('attachments', 5), createTicket);
router.get('/:id', getTicket);
router.patch('/:id', updateTicket);
router.delete('/:id', requireAdmin, deleteTicket);

router.post('/:id/attachments', upload.array('attachments', 5), uploadAttachment);
router.delete('/:id/attachments/:attachmentId', deleteAttachment);

export default router;
