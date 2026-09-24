import { Router } from 'express';
import {
  getTickets,
  createTicket,
  getTicket,
  updateTicket,
  deleteTicket,
  uploadAttachment,
  downloadAttachment,
  deleteAttachment,
} from '../controllers/ticketController';
import { listMessages, createMessage } from '../controllers/ticketMessageController';
import { authenticate, requireAdmin, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Tickets are a client <-> admin concern only — staff/sales never had a UI
// path to these routes, but nothing stopped them calling the API directly.
router.use(authenticate, requireRole('client', 'admin'));

router.get('/', getTickets);
router.post('/', upload.array('attachments', 5), createTicket);
router.get('/:id', getTicket);
router.patch('/:id', updateTicket);
router.delete('/:id', requireAdmin, deleteTicket);

router.post('/:id/attachments', upload.array('attachments', 5), uploadAttachment);
router.get('/:id/attachments/:attachmentId', downloadAttachment);
router.delete('/:id/attachments/:attachmentId', deleteAttachment);

router.get('/:id/messages', listMessages);
router.post('/:id/messages', createMessage);

export default router;
