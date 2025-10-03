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

// -------------------------------------------------------------------------
// SECURE ROUTES - All require a valid JWT token
// -------------------------------------------------------------------------
router.use(verifyJWT); // Apply JWT verification to all routes below

// 1. Create Patient Profile
// Only patients can create their own profile
router.route("/").post(
    verifyRole(["patient"]),
    createPatientProfile
); 

// 2. Get/Update Current Patient Profile (via /me)
// Only the patient themselves can access/update their profile
router.route("/me")
    .get(verifyRole(["patient"]), getCurrentPatientProfile) // GET /api/v1/patients/me
    .patch(verifyRole(["patient"]), updatePatientProfile);  // PATCH /api/v1/patients/me

// 3. Get Patient Profile by User ID
// Only doctors or admins can fetch another user's patient profile
router.route("/:userId").get(
    verifyRole(["doctor", "admin"]),
    getPatientProfileByUserId
); // GET /api/v1/patients/:userId

export default router;
