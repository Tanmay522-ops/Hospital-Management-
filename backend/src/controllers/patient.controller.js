import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Patient } from "../models/patient.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";


const getPopulatedPatientProfile = async (patientId) => {
    return await Patient.findById(patientId)
        .populate({
            path: 'user',
            select: 'username email fullName avatar phone role' 
        })
        .select('-__v'); 
}


const phoneRegex = /^\d{10}$/;

const createPatientProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id; 
    const user = await User.findById(userId);

    if (!user || (user.role !== 'patient' && user.role !== 'admin')) {
        throw new ApiError(403, "Access Denied. User must be a 'patient' or 'admin' to create a profile.");
    }
    

    const existingProfile = await Patient.findOne({ user: userId });
    if (existingProfile) {
        throw new ApiError(409, "Patient profile already exists for this user.");
    }
    
    const { 
        dateOfBirth, 
        gender, 
        address, 
        city, 
        zipCode, 
        bloodGroup, 
        medicalHistory, 
        emergencyContact 
    } = req.body;


    if (
        !dateOfBirth || 
        !gender || 
        !address || 
        !city || 
        !zipCode
    ) {
        throw new ApiError(400, "Missing required fields: dateOfBirth, gender, address, city, or zipCode.");
    }
    
 
    const normalizedGender = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
    if (!['Male', 'Female', 'Other'].includes(normalizedGender)) {
        throw new ApiError(400, "Invalid gender value. Must be Male, Female, or Other.");
    }


    if (isNaN(new Date(dateOfBirth).getTime())) {
        throw new ApiError(400, "Invalid date of birth format.");
    }
   
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
  
        bloodGroup: bloodGroup, 
        medicalHistory: Array.isArray(medicalHistory) ? medicalHistory : [], 
        emergencyContact: emergencyContact || { name: "", phone: "" } 
    });

    const createdProfile = await getPopulatedPatientProfile(patientProfile._id);

    return res.status(201).json(
        new ApiResponse(201, createdProfile, "Patient profile created successfully.")
    );
});

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


const updatePatientProfile = asyncHandler(async (req, res) => {
    const updates = req.body;
    const userId = req.user._id;

    delete updates.user; 

    const patient = await Patient.findOne({ user: userId });
    if (!patient) {
        throw new ApiError(404, "Patient profile not found.");
    }

    const updateFields = {};

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
    

    if (updates.address !== undefined) updateFields.address = updates.address;
    if (updates.city !== undefined) updateFields.city = updates.city;
    if (updates.zipCode !== undefined) updateFields.zipCode = updates.zipCode;
    if (updates.bloodGroup !== undefined) updateFields.bloodGroup = updates.bloodGroup;
    if (updates.medicalHistory !== undefined) updateFields.medicalHistory = updates.medicalHistory;
    if (updates.emergencyContact !== undefined) updateFields.emergencyContact = updates.emergencyContact;

    if (Object.keys(updateFields).length === 0) {
        throw new ApiError(400, "No valid fields provided for update.");
    }
    
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


const getPatientProfileByUserId = asyncHandler(async (req, res) => {
    const targetUserId = req.params.userId;
    const requesterRole = req.user.role;

    if (requesterRole !== 'doctor' && requesterRole !== 'admin') {
        throw new ApiError(403, "Access Denied. Only Doctors or Admins can view other patient profiles.");
    }


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