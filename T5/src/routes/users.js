// src/routes/users.routes.js
import { Router } from 'express';
import {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser
} from '../controllers/users.controller.js';
import { validate, validateObjectId } from '../middleware/validate.middleware.js';
import { createUserSchema, updateUserSchema } from '../schemas/user.schema.js';

const router = Router();

router.get('/', getUsers);
router.get('/:id', validateObjectId(), getUser);
router.post('/', validate(createUserSchema), createUser);
router.put('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', validateObjectId(), deleteUser);

export default router;