import { Router, Request, Response, NextFunction } from 'express';
import authCtrl from '../controllers/authController';

const router = Router();

const validar = (req: Request, res: Response, next: NextFunction) => {
  const datos = Object.values(req.body);
  if (datos.some(v => typeof v !== 'string' || !v.trim())) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  next();
};

const verificarAcceso = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  next();
};

router.get('/', (req, res, next) => authCtrl.ping(req, res, next));

router.post('/login', validar, (req, res, next) => authCtrl.login(req, res, next));

router.post('/forgot-password', validar, (req, res, next) => authCtrl.forgotPassword(req, res, next));

router.post('/reset-password', validar, (req, res, next) => authCtrl.resetPassword(req, res, next));

router.post('/set-password', verificarAcceso, validar, (req, res, next) => authCtrl.setPassword(req, res, next));

export default router;