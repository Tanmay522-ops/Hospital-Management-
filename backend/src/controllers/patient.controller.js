import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Patient } from "../models/patient.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";

// Utility function to fetch and populate the Patient profile
const getPopulatedPatientProfile = async (patientId) => {
    return await Patient.findById(patientId)
        .populate({
            path: 'user',
            select: 'username email fullName avatar phone role' 
        })
        .select('-__v'); 
}

// Phone number validation regex (matches 10 digits as per your schema)
const phoneRegex = /^\d{10}$/;

// ----------------------------------------------------
// 1. Create Patient Profile
// Endpoint: POST /api/v1/patients
// Access: Authenticated User with role 'patient' (or Admin)
// ----------------------------------------------------
const createPatientProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id; 
    const user = await User.findById(userId);

    // Enforce role check for profile creation
    if (!user || (user.role !== 'patient' && user.role !== 'admin')) {
        throw new ApiError(403, "Access Denied. User must be a 'patient' or 'admin' to create a profile.");
    }
    
    // Check for existing profile
    const existingProfile = await Patient.findOne({ user: userId });
    if (existingProfile) {
        throw new ApiError(409, "Patient profile already exists for this user.");
    }
    
    // ⭐ Destructuring ALL fields from the Patient model
    const { 
        dateOfBirth, 
        gender, 
        address, 
        city, 
        zipCode, 
        bloodGroup, 
        medicalHistory, // Expected to be an array of strings
        emergencyContact 
    } = req.body;

    // Validation for MANDATORY fields
    if (
        !dateOfBirth || 
        !gender || 
        !address || 
        !city || 
        !zipCode
    ) {
        throw new ApiError(400, "Missing required fields: dateOfBirth, gender, address, city, or zipCode.");
    }
    
    // Validation for gender enum (using case-insensitivity)
    const normalizedGender = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
    if (!['Male', 'Female', 'Other'].includes(normalizedGender)) {
        throw new ApiError(400, "Invalid gender value. Must be Male, Female, or Other.");
    }

    // Validation for dateOfBirth format
    if (isNaN(new Date(dateOfBirth).getTime())) {
        throw new ApiError(400, "Invalid date of birth format.");
    }
    
    // Validation for emergency contact phone number if provided
    if (emergencyContact && emergencyContact.phone && !phoneRegex.test(emergencyContact.phone)) {
        throw new ApiError(400, "Invalid emergency contact phone number. Must be 10 digits.");
    }

    const patientProfile = await Patient.create({
        user: userId,
        dateOfBirth: new Date(dateOfBirth),
        gender: normalizedGender,
        address,
        city,
        zipCode,
        // Optional fields
        bloodGroup: bloodGroup, 
        // Ensure medicalHistory is an array (even if empty)
        medicalHistory: Array.isArray(medicalHistory) ? medicalHistory : [], 
        emergencyContact: emergencyContact || { name: "", phone: "" } 
    });

    const createdProfile = await getPopulatedPatientProfile(patientProfile._id);

    return res.status(201).json(
        new ApiResponse(201, createdProfile, "Patient profile created successfully.")
    );
});

// ----------------------------------------------------
// 2. Get Current Patient Profile
// Endpoint: GET /api/v1/patients/me
// Access: Authenticated User
// ----------------------------------------------------
const getCurrentPatientProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const patient = await Patient.findOne({ user: userId });

    if (!patient) {
        throw new ApiError(404, "Patient profile not found for the current user. Please create one.");
    }

    const populatedProfile = await getPopulatedPatientProfile(patient._id);

    return res.status(200).json(
        new ApiResponse(200, populatedProfile, "Current patient profile fetched successfully.")
    );
});

// ----------------------------------------------------
// 3. Update Patient Profile
// Endpoint: PATCH /api/v1/patients/me
// Access: Authenticated User
// ----------------------------------------------------
const updatePatientProfile = asyncHandler(async (req, res) => {
    const updates = req.body;
    const userId = req.user._id;

    // Security check: Remove user ID if present in update body
    delete updates.user; 

    // Find the patient profile
    const patient = await Patient.findOne({ user: userId });
    if (!patient) {
        throw new ApiError(404, "Patient profile not found.");
    }

    const updateFields = {};
    
    // Logic to handle specific field updates and validation
    if (updates.dateOfBirth !== undefined) {
        if (isNaN(new Date(updates.dateOfBirth).getTime())) {
            throw new ApiError(400, "Invalid date of birth format.");
        }
        updateFields.dateOfBirth = new Date(updates.dateOfBirth);
    }
    
    if (updates.gender) {
        const normalizedGender = updates.gender.charAt(0).toUpperCase() + updates.gender.slice(1).toLowerCase();
        if (!['Male', 'Female', 'Other'].includes(normalizedGender)) {
            throw new ApiError(400, "Invalid gender value. Must be Male, Female, or Other.");
        }
        updateFields.gender = normalizedGender;
    }

    if (updates.emergencyContact && updates.emergencyContact.phone) {
        if (!phoneRegex.test(updates.emergencyContact.phone)) {
            throw new ApiError(400, "Invalid emergency contact phone number. Must be 10 digits.");
        }
    }
    
    // Include all other simple field updates
    if (updates.address !== undefined) updateFields.address = updates.address;
    if (updates.city !== undefined) updateFields.city = updates.city;
    if (updates.zipCode !== undefined) updateFields.zipCode = updates.zipCode;
    if (updates.bloodGroup !== undefined) updateFields.bloodGroup = updates.bloodGroup;
    if (updates.medicalHistory !== undefined) updateFields.medicalHistory = updates.medicalHistory;
    if (updates.emergencyContact !== undefined) updateFields.emergencyContact = updates.emergencyContact;

    if (Object.keys(updateFields).length === 0) {
        throw new ApiError(400, "No valid fields provided for update.");
    }
    
    // Mongoose will run validators on $set fields, including the bloodGroup enum and nested fields.
    const updatedPatient = await Patient.findOneAndUpdate(
        { user: userId },
        { $set: updateFields },
        { new: true, runValidators: true } 
    );

    const updatedProfile = await getPopulatedPatientProfile(updatedPatient._id);

    return res.status(200).json(
        new ApiResponse(200, updatedProfile, "Patient profile updated successfully.")
    );
});

// ----------------------------------------------------
// 4. Get Patient Profile by User ID (Admin/Doctor Access)
// Endpoint: GET /api/v1/patients/:userId
// Access: Doctor or Admin
// ----------------------------------------------------
const getPatientProfileByUserId = asyncHandler(async (req, res) => {
    const targetUserId = req.params.userId;
    const requesterRole = req.user.role;

    // Enforce authorization
    if (requesterRole !== 'doctor' && requesterRole !== 'admin') {
        throw new ApiError(403, "Access Denied. Only Doctors or Admins can view other patient profiles.");
    }

    // Validate the ID format
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
        throw new ApiError(400, "Invalid user ID format.");
    }

    const patient = await Patient.findOne({ user: targetUserId });

    if (!patient) {
        throw new ApiError(404, "Patient profile not found for this user ID.");
    }

    const populatedProfile = await getPopulatedPatientProfile(patient._id);

    return res.status(200).json(
        new ApiResponse(200, populatedProfile, "Patient profile fetched successfully.")
    );
});


export {
    createPatientProfile,
    getCurrentPatientProfile,
    updatePatientProfile,
    getPatientProfileByUserId,
};