import { Router } from "express";
import { 
    joinQueue,
    updateQueueStatus,
    getDoctorQueue,
    getMyQueueStatus
} from "../controllers/queue.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/role.middleware.js"; 

const router = Router();

// All queue routes require authentication
router.use(verifyJWT);

// POST /api/v1/queue/join - Patient joins a specific doctor's waiting queue
router.route("/join").post(
    verifyRole(["patient"]),
    joinQueue
);

// GET /api/v1/queue/me - Patient checks their current queue status
router.route("/me").get(
    verifyRole(["patient"]),
    getMyQueueStatus
);

// GET /api/v1/queue/doctor/:doctorId - Get the live queue list for a specific doctor
router.route("/doctor/:doctorId").get(getDoctorQueue);

// PATCH /api/v1/queue/:entryId/status - Update patient status in queue (in-progress/completed)
router.route("/:entryId/status").patch(
    verifyRole(["doctor", "admin"]),
    updateQueueStatus
);

export default router;