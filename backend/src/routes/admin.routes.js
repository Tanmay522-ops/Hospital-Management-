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

import { upload } from '../middlewares/multer.middleware.js'; 
import { verifyJWT, isAdmin } from '../middlewares/auth.middleware.js'; 

const router = Router();

router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);

router.use(verifyJWT, isAdmin);

router.route("/create-admin").post(createAdmin);
router.route("/logout").post(logoutUser);
router.route("/change-password").post(changeCurrentPassword);
router.route("/current-user").get(getCurrentUser);
router.route("/update-account").patch(updateAccountDetails);
router.route("/avatar").patch(
    upload.single("avatar"), 
    updateUserAvatar
);
router.route("/cover-image").patch(
    upload.single("coverImage"), 
    updateUserCoverImage
);
router.route("/doctors/pending").get(getPendingDoctorList);
router.route("/doctors/verify/:id").patch(verifyDoctor); 
router.route("/user/:userId").get(getAnyUserProfile);
router.route("/user/deactivate/:userId").patch(deactivateUser);
export default router;