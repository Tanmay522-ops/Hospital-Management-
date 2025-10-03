import { Router } from "express";
import { 
    bookAppointment,
    getUserAppointments,
    updateAppointmentStatus,
    cancelAppointment
} from "../controllers/appointment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/role.middleware.js"; 

const router = Router();

// All appointment routes require authentication
router.use(verifyJWT);

// GET /api/v1/appointments - Get all appointments (filtered by user role)
// This serves all roles: patient sees own, doctor sees own, admin sees all.
router.route("/").get(getUserAppointments);

// POST /api/v1/appointments - Book a new appointment
router.route("/").post(
    verifyRole(["patient"]),
    bookAppointment
);

// PATCH /api/v1/appointments/:id/status - Update appointment status (Confirmed/Completed)
router.route("/:id/status").patch(
    verifyRole(["doctor", "admin"]),
    updateAppointmentStatus
);

// PATCH /api/v1/appointments/:id/cancel - Cancel appointment (Patient/Doctor/Admin)
router.route("/:id/cancel").patch(
    cancelAppointment
);

export default router;