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
    updateAccountDetails
} from "../controllers/user.controller.js";

import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyRole } from "../middlewares/role.middleware.js";

const router = Router();

// Registration & Login (no role check here because user isn't logged in yet)
router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 }
    ]),
    registerUser
);

router.route("/login").post(loginUser);

router.route("/refresh-token").post(refreshAccessToken);

// Protected routes (role: patient)
router.route("/logout").post(
    verifyJWT,
    verifyRole(["patient"]),
    logoutUser
);

router.route("/change-password").post(
    verifyJWT,
    verifyRole(["patient"]),
    changeCurrentPassword
);

router.route("/current-user").get(
    verifyJWT,
    verifyRole(["patient"]),
    getCurrentUser
);

router.route("/update-account").patch(
    verifyJWT,
    verifyRole(["patient"]),
    updateAccountDetails
);

router.route("/avatar").patch(
    verifyJWT,
    verifyRole(["patient"]),
    upload.single("avatar"),
    updateUserAvatar
);

router.route("/cover-image").patch(
    verifyJWT,
    verifyRole(["patient"]),
    upload.single("coverImage"),
    updateUserCoverImage
);

export default router;
