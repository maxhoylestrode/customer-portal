import { Router } from 'express';
import * as projects from '../controllers/projectController';
import { authenticate, requireStaff, denyRole } from '../middleware/auth';

// NOTE: "Project" in the database/API is shown to users as a "Task".
const router = Router();

router.use(authenticate, requireStaff);
router.use(denyRole('sales')); // Sales staff cannot access tasks

router.get('/', projects.list);
router.get('/:id', projects.getById);
router.post('/', projects.create);
router.put('/:id', projects.update);
router.delete('/:id', projects.remove);

// Updates feed (comments)
router.post('/:id/updates', projects.addUpdate);
router.delete('/:id/updates/:updateId', projects.removeUpdate);

// Subtasks
router.post('/:id/subtasks', projects.addSubtask);
router.put('/:id/subtasks/:subtaskId', projects.updateSubtask);
router.delete('/:id/subtasks/:subtaskId', projects.removeSubtask);

export default router;
