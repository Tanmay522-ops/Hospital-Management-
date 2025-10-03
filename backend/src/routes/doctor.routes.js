// File: routes/doctor.routes.js

import { Router } from "express";
import { 
    loginUser, 
    logoutUser, 
    registerUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateUserAvatar, 
    updateUserCoverImage, 
    updateAccountDetails,
    createDoctorProfile,
    getAllDoctors,
    getDoctorById,
    updateDoctorProfile,
    getDoctorAvailability
} from "../controllers/doctor.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/role.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// ----------------------------
// Auth Routes
// ----------------------------
router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 }, 
        { name: "coverImage", maxCount: 1 }
    ]),
    registerUser
);

router.route("/login").post(loginUser);

router.route("/logout").post(
    verifyJWT, 
    verifyRole(["doctor"]), 
    logoutUser
);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/change-password").post(
    verifyJWT, 
    verifyRole(["doctor"]), 
    changeCurrentPassword
);

router.route("/current-user").get(
    verifyJWT, 
    verifyRole(["doctor"]), 
    getCurrentUser
);

router.route("/update-account").patch(
    verifyJWT, 
    verifyRole(["doctor"]), 
    updateAccountDetails
);

router.route("/avatar").patch(
    verifyJWT, 
    verifyRole(["doctor"]), 
    upload.single("avatar"), 
    updateUserAvatar
);

router.route("/cover-image").patch(
    verifyJWT, 
    verifyRole(["doctor"]), 
    upload.single("coverImage"), 
    updateUserCoverImage
);

// ----------------------------
// Public Doctor Routes
// ----------------------------
router.route("/").get(getAllDoctors);
router.route("/:id").get(getDoctorById);
router.route("/:id/availability").get(getDoctorAvailability);

// ----------------------------
// Doctor Profile Creation (Step 2 of Registration)
// ----------------------------
router.route("/profile").post(
    verifyJWT, 
    verifyRole(["doctor"]),
    upload.single("proofDocument"),
    createDoctorProfile
);

// ----------------------------
// Protected Doctor Profile Update
// ----------------------------
router.route("/:id").patch(
    verifyJWT, 
    verifyRole(["doctor", "admin"]),
    updateDoctorProfile
);

export default router;
