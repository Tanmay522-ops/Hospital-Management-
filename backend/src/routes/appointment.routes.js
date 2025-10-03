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

router.use(verifyJWT);

router.route("/").get(getUserAppointments);

router.route("/").post(
    verifyRole(["patient"]),
    bookAppointment
);

router.route("/:id/status").patch(
    verifyRole(["doctor", "admin"]),
    updateAppointmentStatus
);
router.route("/:id/cancel").patch(
    cancelAppointment
);

export default router;