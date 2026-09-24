import { Router } from 'express';
import { authenticate, requireStaff } from '../middleware/auth';
import * as m from '../controllers/meetingController';

const router = Router();

router.use(authenticate, requireStaff);

// Available slots
router.get('/available-slots', m.listAvailableSlots);
router.post('/available-slots', m.addAvailableSlot);
router.delete('/available-slots/:id', m.removeAvailableSlot);

// Meetings
router.get('/', m.listMeetings);
router.post('/', m.createMeeting);
router.put('/:id', m.updateMeeting);
router.delete('/:id', m.deleteMeeting);

export default router;
