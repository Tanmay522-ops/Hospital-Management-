import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { verifyRole } from '../middlewares/role.middleware.js';
import {
    createPatientProfile,
    getCurrentPatientProfile,
    updatePatientProfile,
    getPatientProfileByUserId,
} from '../controllers/patient.controller.js';

const router = Router();
router.use(verifyJWT); 
router.route("/").post(
    verifyRole(["patient"]),
    createPatientProfile
); 
router.route("/me")
    .get(verifyRole(["patient"]), getCurrentPatientProfile) 
    .patch(verifyRole(["patient"]), updatePatientProfile);  
router.route("/:userId").get(
    verifyRole(["doctor", "admin"]),
    getPatientProfileByUserId
); 

export default router;
