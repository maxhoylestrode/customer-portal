import { Router } from 'express';
import { getPublicKey, subscribe, unsubscribe, getStatus } from '../controllers/pushController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public: the VAPID public key isn't sensitive, and the client needs it
// before a user has necessarily done anything else.
router.get('/vapid-public-key', getPublicKey);

router.use(authenticate);
router.get('/status', getStatus);
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

export default router;
