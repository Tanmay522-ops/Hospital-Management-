import { Doctor } from "../models/doctor.model.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"; 
import mongoose from "mongoose";
import jwt from "jsonwebtoken";


const generateAccessAndRefereshTokens = async (userId) => {
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


const getPopulatedDoctorProfile = async (doctorId, includeSensitive = false) => {
    let selectFields = 'username email fullName avatar phone role';
    let doctorSelect = '-__v';

    if (!includeSensitive) {
        doctorSelect += ' -proofDocument'; 
    }

    return await Doctor.findById(doctorId)
        .select(doctorSelect)
        .populate({
            path: 'user',
            select: selectFields 
        });
}


const registerUser = asyncHandler( async (req, res) => {
    
    const {fullName, email, username, password,phone } = req.body
    const role = "doctor";
    
    if (
        [fullName, email, username, password, phone].some((field) => !field?.trim())
    ) {
        throw new ApiError(400, "Full Name, Email, Username, Password, and Phone are required.")
    }

    const normalizedUsername = username.toLowerCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    const existedUser = await User.findOne({
    $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    
    const avatarLocalPath = req.files?.avatar?.[0]?.path; // Using optional chaining for safety

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const [avatar, coverImage] = await Promise.all([
        uploadOnCloudinary(avatarLocalPath),
        uploadOnCloudinary(coverImageLocalPath)
    ]);
    
    if (!avatar?.url) {
        throw new ApiError(400, "Avatar file upload failed.")
    }
   
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        phone,
        email: normalizedEmail, 
        role,
        password,
        username: normalizedUsername
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "Doctor registered Successfully. Now create your profile.")
    )

} )


const loginUser = asyncHandler(async (req, res) =>{
    const {email, username, password} = req.body

    if (!username && !email) {
        throw new ApiError(400, "Username or email is required")
    }

  const user = await User.findOne({
        $or: [{ username }, { email }],
        role: "doctor" 
    })
    
    .select("+password"); 


    if (!user) {
        throw new ApiError(404, "Doctor user does not exist")
    }
    
    
   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid doctor credentials")
   }

   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)
   
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly: true,
        secure: true
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
            "Doctor logged In Successfully"
        )
    )

})


const logoutUser = asyncHandler(async(req, res) => {
    if (req.user.role !== "doctor") {
        throw new ApiError(403, "Forbidden: not a doctor account");
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
    .json(new ApiResponse(200, {}, "Doctor logged Out"))
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
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (user.role !== "doctor") {
            throw new ApiError(403, "Forbidden: not a doctor account");
        }
 
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }   
        const options = {
            httpOnly: true,
            secure: true
        }
    
        
        const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)
    
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


    const user = await User.findById(req.user?._id).select("+password");

    if (user.role !== "doctor") {
        throw new ApiError(403, "Forbidden: not a doctor account");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save() 

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
     if (req.user.role !== "doctor") {
        throw new ApiError(403, "Forbidden: not a doctor account");
    }
    
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "Doctor fetched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email,username} = req.body

    if (!fullName || !email || !username) {
        throw new ApiError(400, "All fields are required")
    } 

    if (req.user.role !== "doctor") {
        throw new ApiError(403, "Forbidden: not a doctor account");
    }
    
    const normalizedUsername = username.toLowerCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ 
        username: normalizedUsername,
        _id: { $ne: req.user._id } 
    });

    if (existingUser) {
        throw new ApiError(409, "Username is already taken. Please choose another one.");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: normalizedEmail,
                username: normalizedUsername 
            }
        },
        {new: true, runValidators: true} 
        
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});


const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

     if (req.user.role !== "doctor") {
        throw new ApiError(403, "Forbidden: not a doctor account");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar?.url) { 
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

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

     if (req.user.role !== "doctor") {
        throw new ApiError(403, "Forbidden: not a doctor account");
    }


    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage?.url) { 
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

const createDoctorProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id; 
    
    const { specialization, experience, registrationNumber, availability } = req.body;

    if (req.user.role !== 'doctor') {
        throw new ApiError(403, "Access Denied. User must have the 'doctor' role to create a profile.");
    }

    if (!specialization || !registrationNumber) {
        throw new ApiError(400, "Specialization and Medical Registration Number are required.");
    }
    
    const existingProfile = await Doctor.findOne({ user: userId });
    if (existingProfile) {
        throw new ApiError(409, "Doctor profile already exists for this user.");
    }

    const regNumExists = await Doctor.findOne({ registrationNumber });
    if (regNumExists) {
        throw new ApiError(409, "A doctor with this Registration Number is already registered.");
    }

    const proofDocumentLocalPath = req.file?.path; 
    if (!proofDocumentLocalPath) {
        throw new ApiError(400, "Medical registration proof document is mandatory for verification.");
    }

    const proofDocumentFile = await uploadOnCloudinary(proofDocumentLocalPath); 
    if (!proofDocumentFile?.url) {
        throw new ApiError(500, "Failed to upload verification document. Please check your file and try again.");
    }

    const doctorProfile = await Doctor.create({
        user: userId,
        specialization,
        experience: experience || 0,
        registrationNumber,
        proofDocument: proofDocumentFile.url,
        availability: availability || [],
        isVerified: false,
        verificationStatus: 'pending'
    });

    const createdProfile = await getPopulatedDoctorProfile(doctorProfile._id);

    return res.status(201).json(
        new ApiResponse(201, createdProfile, "Doctor profile created. Verification pending.")
    );
});

const getAllDoctors = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, specialization } = req.query;
    
    let query = { isVerified: true }; 

    if (specialization) {
        query.specialization = specialization;
    }

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: {
            path: 'user',
            select: 'fullName email avatar phone'
        },
        select: '-proofDocument -registrationNumber -isVerified -verificationStatus -__v', 
        sort: { specialization: 1, 'user.fullName': 1 }
    };

    const doctors = await Doctor.paginate(query, options);

    return res.status(200).json(
        new ApiResponse(200, doctors, "Verified doctors fetched successfully.")
    );
});

const getDoctorById = asyncHandler(async (req, res) => {
    const doctorId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        throw new ApiError(400, "Invalid doctor ID.");
    }

    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
        throw new ApiError(404, "Doctor profile not found.");
    }
    
    const isAuthenticated = !!req.user;
    
    let isRequesterOwnerOrAdmin = false;
    if (isAuthenticated) {
        isRequesterOwnerOrAdmin = doctor.user.toString() === req.user._id.toString() || req.user.role === 'admin';
    }
    
    if (!doctor.isVerified && !isRequesterOwnerOrAdmin) {
        throw new ApiError(404, "Doctor profile not found or is pending verification.");
    }

    const populatedProfile = await getPopulatedDoctorProfile(doctorId, isRequesterOwnerOrAdmin);

    return res.status(200).json(
        new ApiResponse(200, populatedProfile, "Doctor profile fetched successfully.")
    );
});


const updateDoctorProfile = asyncHandler(async (req, res) => {
    const doctorId = req.params.id;
    const { specialization, experience, availability } = req.body; 
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        throw new ApiError(400, "Invalid doctor ID.");
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
        throw new ApiError(404, "Doctor profile not found.");
    }

    if (doctor.user.toString() !== userId.toString() && req.user.role !== 'admin') {
        throw new ApiError(403, "Unauthorized to update this profile.");
    }
    
    delete req.body.registrationNumber;
    delete req.body.proofDocument;
    delete req.body.isVerified;
    delete req.body.verificationStatus;

    if (Object.keys(req.body).length === 0) {
        throw new ApiError(400, "No valid fields provided for update.");
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(
        doctorId,
        { $set: req.body }, 
        { new: true, runValidators: true }
    );

    const updatedProfile = await getPopulatedDoctorProfile(updatedDoctor._id);

    return res.status(200).json(
        new ApiResponse(200, updatedProfile, "Doctor profile updated successfully.")
    );
});

const getDoctorAvailability = asyncHandler(async (req, res) => {
    const doctorId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        throw new ApiError(400, "Invalid doctor ID.");
    }

    const doctor = await Doctor.findById(doctorId).select('availability isVerified');

    if (!doctor || !doctor.isVerified) {
        throw new ApiError(404, "Doctor profile not found or not yet verified.");
    }

    return res.status(200).json(
        new ApiResponse(200, doctor.availability, "Doctor availability fetched successfully.")
    );
});


const verifyDoctor = asyncHandler(async (req, res) => {
    const doctorId = req.params.id;
    const { status } = req.body; 
    
    if (req.user.role !== 'admin') {
         throw new ApiError(403, "Forbidden. Only Admins can verify doctors.");
    }

    if (!['approved', 'rejected'].includes(status)) {
        throw new ApiError(400, "Status must be 'approved' or 'rejected'.");
    }
    
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
        throw new ApiError(404, "Doctor profile not found.");
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(
        doctorId,
        {
            $set: {
                isVerified: (status === 'approved'),
                verificationStatus: status
            }
        },
        { new: true } 
    );
    

    const populatedProfile = await getPopulatedDoctorProfile(updatedDoctor._id, true);

    return res.status(200).json(
        new ApiResponse(
            200, 
            populatedProfile, 
            `Doctor verification status set to ${status}.`
        )
    );
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    createDoctorProfile,
    getAllDoctors,
    getDoctorById,
    updateDoctorProfile,
    getDoctorAvailability,
    verifyDoctor,
};