import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import {
  createProjectSchema,
  updateProjectSchema,
  idParamSchema,
  listProjectSchema,
} from '../validators/project.validator';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  listArchivedProjects,
  restoreProject,
} from '../controllers/project.controller';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Gestion de proyectos
 */

router.post('/',              validate(createProjectSchema), createProject);
router.get('/',               validate(listProjectSchema),   listProjects);
router.get('/archived',                                      listArchivedProjects);
router.get('/:id',            validate(idParamSchema),       getProject);
router.put('/:id',            validate(updateProjectSchema), updateProject);
router.delete('/:id',         validate(idParamSchema),       deleteProject);
router.patch('/:id/restore',  validate(idParamSchema),       restoreProject);

export default router;
