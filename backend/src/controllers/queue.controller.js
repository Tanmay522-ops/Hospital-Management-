import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Queue } from "../models/queue.model.js";
import { Doctor } from "../models/doctor.model.js";
import { Patient } from "../models/patient.model.js";
import mongoose from "mongoose";

const calculateEstimatedTime = async (doctorId, newPosition) => {
    const averageTimePerPatientMinutes = 15; 
    let currentTime = new Date();

    const delayMinutes = (newPosition - 1) * averageTimePerPatientMinutes;

    currentTime.setMinutes(currentTime.getMinutes() + delayMinutes);
    
    return currentTime;
};

const getPopulatedQueueEntry = async (entryId) => {
    return await Queue.findById(entryId)
        .populate({
            path: 'patient',
            select: 'user',
            populate: {
                path: 'user',
                select: 'fullName'
            }
        })
        .populate({
            path: 'doctor',
            select: 'user specialization',
            populate: {
                path: 'user',
                select: 'fullName'
            }
        })
        .select('-__v');
}
const joinQueue = asyncHandler(async (req, res) => {
    const { doctorId } = req.body;
    const userId = req.user._id;

    if (!doctorId) {
        throw new ApiError(400, "Doctor ID is required to join the queue.");
    }
    const patientProfile = await Patient.findOne({ user: userId });
    if (!patientProfile) {
        throw new ApiError(404, "Patient profile not found. Please complete your profile.");
    }
    const patientId = patientProfile._id;
    const doctorProfile = await Doctor.findById(doctorId);
    if (!doctorProfile) {
        throw new ApiError(404, "Doctor not found.");
    }
    const existingEntry = await Queue.findOne({
        doctor: doctorId,
        patient: patientId,
        status: { $in: ["waiting", "in-progress"] }
    });

    if (existingEntry) {
        throw new ApiError(409, `You are already in this doctor's queue at position ${existingEntry.position}.`);
    }

    const lastEntry = await Queue.findOne({ doctor: doctorId, status: "waiting" })
        .sort({ position: -1 })
        .select('position');

    const nextPosition = (lastEntry?.position || 0) + 1;
    const estimatedTime = await calculateEstimatedTime(doctorId, nextPosition);

    const queueEntry = await Queue.create({
        doctor: doctorId,
        patient: patientId,
        position: nextPosition,
        estimatedTime,
        status: "waiting"
    });

    const populatedEntry = await getPopulatedQueueEntry(queueEntry._id);

    return res.status(201).json(
        new ApiResponse(201, populatedEntry, `Joined queue at position ${nextPosition}. Estimated time: ${estimatedTime.toLocaleTimeString()}.`)
    );
});

const updateQueueStatus = asyncHandler(async (req, res) => {
    const entryId = req.params.entryId;
    const { status } = req.body;
    const userId = req.user._id;

    if (!status || !['in-progress', 'completed'].includes(status.toLowerCase())) {
        throw new ApiError(400, "Invalid or missing status. Must be 'in-progress' or 'completed'.");
    }

    const queueEntry = await Queue.findById(entryId).populate('doctor');

    if (!queueEntry) {
        throw new ApiError(404, "Queue entry not found.");
    }
    let authorized = req.user.role === 'admin';
    if (req.user.role === 'doctor') {
        const doctorProfile = await Doctor.findOne({ user: userId });
        if (doctorProfile && queueEntry.doctor._id.equals(doctorProfile._id)) {
            authorized = true;
        }
    }

    if (!authorized) {
        throw new ApiError(403, "Unauthorized to update this queue status.");
    }

    const newStatus = status.toLowerCase();

    if (newStatus === 'in-progress' && queueEntry.status !== 'waiting') {
        throw new ApiError(400, "Cannot start consultation on a patient who is not 'waiting'.");
    }

    const updatedEntry = await Queue.findByIdAndUpdate(
        entryId,
        { $set: { status: newStatus } },
        { new: true }
    );

    if (newStatus === 'completed') {
        await Queue.updateMany(
            { doctor: queueEntry.doctor._id, status: 'waiting', position: { $gt: queueEntry.position } },
            { $inc: { position: -1 } }
        );
    }

    const finalEntry = await getPopulatedQueueEntry(updatedEntry._id);

    return res.status(200).json(
        new ApiResponse(200, finalEntry, `Patient status updated to ${newStatus}.`)
    );
});

const getDoctorQueue = asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        throw new ApiError(400, "Invalid doctor ID.");
    }
    const queueList = await Queue.find({
        doctor: doctorId,
        status: { $in: ["waiting", "in-progress"] }
    })
    .sort({ position: 1 })
    .populate({
        path: 'patient',
        select: 'user',
        populate: { path: 'user', select: 'fullName avatar' }
    })
    .select('position status estimatedTime');

    if (!queueList || queueList.length === 0) {
        return res.status(200).json(new ApiResponse(200, [], "The queue is currently empty."));
    }

    return res.status(200).json(
        new ApiResponse(200, queueList, "Doctor's queue list fetched successfully.")
    );
});
const getMyQueueStatus = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const patientProfile = await Patient.findOne({ user: userId }).select('_id');
    if (!patientProfile) {
        throw new ApiError(404, "Patient profile not found.");
    }

    const myEntry = await Queue.findOne({
        patient: patientProfile._id,
        status: { $in: ["waiting", "in-progress"] }
    })
    .populate({
        path: 'doctor',
        select: 'user',
        populate: { path: 'user', select: 'fullName' }
    })
    .select('position status estimatedTime doctor');
    
    if (!myEntry) {
        return res.status(200).json(new ApiResponse(200, null, "You are not currently in a queue."));
    }

    return res.status(200).json(
        new ApiResponse(200, myEntry, `Your status in Dr. ${myEntry.doctor.user.fullName}'s queue is: ${myEntry.status}.`)
    );
});


export {
    joinQueue,
    updateQueueStatus,
    getDoctorQueue,
    getMyQueueStatus,
};