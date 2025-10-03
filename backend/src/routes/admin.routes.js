// File: routes/admin.routes.js

import { Router } from 'express';
import { 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage, 
    getPendingDoctorList, 
    verifyDoctor, 
    deactivateUser, 
    getAnyUserProfile, 
    createAdmin 
} from '../controllers/admin.controller.js';

// Assuming the following paths are correct:
import { upload } from '../middlewares/multer.middleware.js'; 
import { verifyJWT, isAdmin } from '../middlewares/auth.middleware.js'; 

const router = Router();

// =========================================================================
// 1. PUBLIC ROUTES (Authentication - Accessible to anyone)
// =========================================================================

// POST /api/v1/admin/login 
router.route("/login").post(loginUser);

// POST /api/v1/admin/refresh-token
router.route("/refresh-token").post(refreshAccessToken);



// =========================================================================
// 2. PROTECTED ADMIN BLOCK
// Apply JWT verification AND Admin role check to ALL subsequent routes.
// =========================================================================

// This single line protects every route defined below it.
router.use(verifyJWT, isAdmin);


// ---------------------------
// Admin Creation & Profile Routes
// ---------------------------
// POST /api/v1/admin/create-admin (Requires an existing admin to run)
router.route("/create-admin").post(createAdmin);


// POST /api/v1/admin/logout
router.route("/logout").post(logoutUser);

// POST /api/v1/admin/change-password
router.route("/change-password").post(changeCurrentPassword);

// GET /api/v1/admin/current-user
router.route("/current-user").get(getCurrentUser);

// PATCH /api/v1/admin/update-account
router.route("/update-account").patch(updateAccountDetails);

// PATCH /api/v1/admin/avatar
router.route("/avatar").patch(
    upload.single("avatar"), 
    updateUserAvatar
);

// PATCH /api/v1/admin/cover-image
router.route("/cover-image").patch(
    upload.single("coverImage"), 
    updateUserCoverImage
);

// ---------------------------
// Doctor Management Routes
// ---------------------------
// GET /api/v1/admin/doctors/pending
router.route("/doctors/pending").get(getPendingDoctorList);

// PATCH /api/v1/admin/doctors/verify/:id 
// (The ID here is the Doctor model ID)
router.route("/doctors/verify/:id").patch(verifyDoctor); 

// ---------------------------
// General User Management Routes
// ---------------------------
// GET /api/v1/admin/user/:userId
router.route("/user/:userId").get(getAnyUserProfile);

// PATCH /api/v1/admin/user/deactivate/:userId
router.route("/user/deactivate/:userId").patch(deactivateUser);


export default router;