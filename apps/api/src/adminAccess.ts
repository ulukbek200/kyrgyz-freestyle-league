import type {RequestHandler} from 'express';

// Deny by default: allowing registration must never expose the whole admin router.
const registrarRoutes=new Set(['GET /session','GET /lookups','GET /age-reference','GET /age-divisions','POST /athletes','POST /uploads']);
export const adminAccess:RequestHandler=(req,res,next)=>{
 const path=req.path.replace(/\/$/,'');
 if(req.user?.role==='ADMIN'||(req.user?.role==='REGISTRAR'&&registrarRoutes.has(`${req.method} ${path}`)))return next();
 res.status(403).json({error:'Insufficient permissions'});
};
