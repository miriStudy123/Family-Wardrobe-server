import { Router } from 'express';
import { authenticate, requireRole } from './middleware/auth';
import { authRouter } from './modules/auth/auth.routes';
import { childrenRouter } from './modules/children/children.routes';
import { clothingRouter } from './modules/clothing/clothing.routes';
import { familiesRouter } from './modules/families/families.routes';
import { messagesRouter } from './modules/messages/messages.routes';
import { outfitsRouter } from './modules/outfits/outfits.routes';
import { selectionRouter } from './modules/selection/selection.routes';

export const apiRouter = Router();

apiRouter.use('/families', familiesRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/children', authenticate, childrenRouter);
apiRouter.use('/clothing', authenticate, clothingRouter);
apiRouter.use('/current-selection', authenticate, requireRole('child'), selectionRouter);
apiRouter.use('/outfits', authenticate, requireRole('child'), outfitsRouter);
apiRouter.use('/messages', authenticate, messagesRouter);
