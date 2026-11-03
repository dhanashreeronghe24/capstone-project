import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/http-error';
import { memberController as c } from './member.controller';
import {
  AddressInputSchema,
  IdParamSchema,
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  UpdateProfileSchema,
} from './member.schema';

export const authRouter = Router();
authRouter.post('/register', validate(RegisterSchema), asyncHandler(c.register));
authRouter.post('/login', validate(LoginSchema), asyncHandler(c.login));
authRouter.post('/refresh', validate(RefreshSchema), asyncHandler(c.refresh));
authRouter.post('/logout', authenticate, validate(RefreshSchema), asyncHandler(c.logout));

export const memberRouter = Router();
memberRouter.use(authenticate, requireRole('ROLE_CUSTOMER'));
memberRouter.get('/me', asyncHandler(c.getMe));
memberRouter.put('/me', validate(UpdateProfileSchema), asyncHandler(c.updateMe));
memberRouter.get('/me/addresses', asyncHandler(c.listAddresses));
memberRouter.post('/me/addresses', validate(AddressInputSchema), asyncHandler(c.addAddress));
memberRouter.delete('/me/addresses/:id', validate(IdParamSchema, 'params'), asyncHandler(c.deleteAddress));
