import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Doctor } from "../models/doctor.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found for token generation"); 
        }
        
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false }); 
        
        return { accessToken, refreshToken };
    } catch (error) {
        console.error("Token generation error:", error); 
        throw new ApiError(
            500,
            "Something went wrong while generating refresh and access token"
        );
    }
};


// =================================================================
// 🔒 ADMIN AUTH CONTROLLERS (Require admin credentials/JWT)
// =================================================================

const loginUser = asyncHandler(async (req, res) => {
    // Normalize inputs
    const rawEmail = req.body.email
    const rawUsername = req.body.username
    const password = req.body.password

    const email = rawEmail ? String(rawEmail).toLowerCase().trim() : undefined
    const username = rawUsername ? String(rawUsername).toLowerCase().trim() : undefined

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    // Crucial: Select '+password' and filter by role: 'admin'
    const user = await User.findOne({
        $or: [{ username }, { email }],
        role: "admin"
    }).select("+password");

    if (!user) {
        throw new ApiError(404, "Admin user does not exist")
    }
    
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid admin credentials") 
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "Admin logged In Successfully"
            )
        )
})

const logoutUser = asyncHandler(async(req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Forbidden: not an admin account");
    }
    
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        // Fetch user based on token ID
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (user.role !== "admin") {
            throw new ApiError(403, "Forbidden: not an admin account");
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }   
        
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Both old and new passwords are required");
    }

    // FIX: Must select '+password' to compare the old password
    const user = await User.findById(req.user?._id).select("+password") 

    if (!user) {
        throw new ApiError(404, "User not found"); 
    }

    // Enforce admin check
    if (user.role !== "admin") {
        throw new ApiError(403, "Forbidden: not an admin account");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }
    
    // Mongoose pre-save hook will hash the newPassword
    user.password = newPassword 
    await user.save()

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Forbidden: not an admin account");
    }
    
    // req.user is populated by verifyJWT and safe to return
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "Admin user fetched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email, username} = req.body

    if (!fullName || !email || !username) {
        throw new ApiError(400, "All fields are required")
    } 

    if (req.user.role !== "admin") {
        throw new ApiError(403, "Forbidden: not an admin account");
    }

    // Normalize inputs here for consistency with login/create
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email.toLowerCase().trim(),
                username: username.toLowerCase().trim()
            }
        },
        {new: true}
        
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (req.user.role !== "admin") {
        throw new ApiError(403, "Forbidden: not an admin account");
    }
    
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    //TODO: delete old image - assignment

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    
    if (!avatar?.url) { // Check for truthiness and url property
        throw new ApiError(400, "Error while uploading avatar to Cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (req.user.role !== "admin") {
        throw new ApiError(403, "Forbidden: not an admin account");
    }
    
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    //TODO: delete old image - assignment

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage?.url) { // Check for truthiness and url property
        throw new ApiError(400, "Error while uploading cover image to Cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})


// =================================================================
// 👑 ADMIN MANAGEMENT CONTROLLERS
// =================================================================

// ---------------------------
// Get Pending Doctor List
// ---------------------------
const getPendingDoctorList = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Forbidden: not an admin account");
    }
    
    const pendingDoctors = await Doctor.find({ verificationStatus: "pending" })
        .populate("user", "fullName email phone")
        .select("specialization registrationNumber proofDocument createdAt");

    return res.status(200).json(new ApiResponse(200, pendingDoctors, "Pending doctors fetched successfully"));
});

// ---------------------------
// Verify Doctor
// ---------------------------
const verifyDoctor = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Forbidden: not an admin account");
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) throw new ApiError(400, "Invalid status");
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid doctor ID");

    const doctor = await Doctor.findById(id);
    if (!doctor) throw new ApiError(404, "Doctor not found");

    // Update Doctor Profile
    doctor.isVerified = status === "approved";
    doctor.verificationStatus = status;
    await doctor.save();

    // Update the linked User's role/verification status
    const updateUserData = status === "approved" 
        ? { $set: { isVerified: true, role: "doctor" } }
        : { $set: { isVerified: false } }; // Mark user as not verified if rejected

    const populatedProfile = await User.findByIdAndUpdate(doctor.user, updateUserData, { new: true }).select("-password -refreshToken");
    
    return res.status(200).json(new ApiResponse(200, populatedProfile, `Doctor verification set to ${status}`));
});

// ---------------------------
// Deactivate User
// ---------------------------
const deactivateUser = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Forbidden: not an admin account");
    }
    
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new ApiError(400, "Invalid user ID");
    
    // Prevent self-deactivation
    if (req.user._id.toString() === userId) throw new ApiError(400, "Cannot deactivate own account");

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: { isActive: false, refreshToken: null } }, { new: true, select: "fullName email role isActive" });
    if (!updatedUser) throw new ApiError(404, "User not found");

    return res.status(200).json(new ApiResponse(200, updatedUser, `User ${updatedUser.email} deactivated`));
});

// ---------------------------
// Get Any User Profile
// ---------------------------
const getAnyUserProfile = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Forbidden: not an admin account");
    }

    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new ApiError(400, "Invalid user ID");

    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) throw new ApiError(404, "User not found");

    return res.status(200).json(new ApiResponse(200, user, "User profile fetched"));
});

// ---------------------------
// Create Admin
// ---------------------------
// ---------------------------
// Create Admin (CORRECTED)
// ---------------------------
const createAdmin = asyncHandler(async (req, res) => {
    // 💥 TEMPORARILY COMMENTED OUT FOR INITIAL BOOTSTRAPPING 💥
    // This must remain commented out until the first admin is created.
    if (req.user.role !== "admin") { 
        throw new ApiError(403, "Forbidden: Only an existing admin can create a new admin");
    }
   
    // ✅ ADD username and avatar to destructuring and validation ✅
    const { fullName, email, phone, password, username, avatar } = req.body;
    
    // Update validation to check for all required fields
    if (!fullName || !email || !password || !username || !avatar) {
        // This validation check preempts the Mongoose validation error
        throw new ApiError(400, "Full Name, Email, Password, Username, and Avatar are all required fields.");
    }

    const exists = await User.findOne({ email });
    if (exists) throw new ApiError(400, "User with this email already exists");

    // The User model pre-save hook will hash the password
    const admin = await User.create({ 
        fullName, 
        email: email.toLowerCase().trim(), 
        phone, 
        password, 
        // ✅ INCLUDE REQUIRED FIELDS IN THE CREATION OBJECT ✅
        username: username.toLowerCase().trim(),
        avatar: avatar, // Use the provided avatar URL
        role: "admin", 
        isVerified: true, 
        isActive: true 
    });
    
    // Fetch the created admin without sensitive data for the response
    const createdAdmin = await User.findById(admin._id).select("fullName email role isActive createdAt");

    return res.status(201).json(new ApiResponse(201, createdAdmin, "Admin created successfully"));
});


// =================================================================
// 🔄 EXPORTS
// =================================================================

export {
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
    createAdmin,
};