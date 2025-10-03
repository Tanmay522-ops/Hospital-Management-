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
router.use(verifyJWT);
router.route("/join").post(
    verifyRole(["patient"]),
    joinQueue
);
router.route("/me").get(
    verifyRole(["patient"]),
    getMyQueueStatus
);
router.route("/doctor/:doctorId").get(getDoctorQueue);
router.route("/:entryId/status").patch(
    verifyRole(["doctor", "admin"]),
    updateQueueStatus
);

export default router;