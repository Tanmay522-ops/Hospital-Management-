import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Appointment } from "../models/appointment.model.js";
import { Doctor } from "../models/doctor.model.js";
import { Patient } from "../models/patient.model.js";

const getPopulatedAppointment = async (appointmentId) => {
    return await Appointment.findById(appointmentId)
        .populate({
            path: 'patient',
            select: 'user',
            populate: {
                path: 'user',
                select: 'fullName email phone'
            }
        })
        .populate({
            path: 'doctor',
            select: 'user specialization',
            populate: {
                path: 'user',
                select: 'fullName email phone'
            }
        })
        .select('-__v');
}


const bookAppointment = asyncHandler(async (req, res) => {
    const { doctorId, date, startTime, endTime } = req.body;
    const userId = req.user._id;

    if (!doctorId || !date || !startTime || !endTime) {
        throw new ApiError(400, "Doctor ID, date, start time, and end time are required.");
    }

    const patientProfile = await Patient.findOne({ user: userId });
    if (!patientProfile) {
        throw new ApiError(404, "Patient profile not found. Complete your profile first.");
    }
    const patientId = patientProfile._id;

    const doctorProfile = await Doctor.findById(doctorId);
    if (!doctorProfile) {
        throw new ApiError(404, "Doctor profile not found.");
    }

    const conflict = await Appointment.findOne({
        doctor: doctorId,
        "slot.date": new Date(date),
        "slot.startTime": startTime,
        status: { $in: ["pending", "confirmed"] }
    });

    if (conflict) {
        throw new ApiError(409, "The selected slot is already booked or pending confirmation.");
    }

    const appointment = await Appointment.create({
        patient: patientId,
        doctor: doctorId,
        slot: {
            date: new Date(date),
            startTime,
            endTime,
        },
        status: "pending",
    });

    const bookedAppointment = await getPopulatedAppointment(appointment._id);

    return res.status(201).json(
        new ApiResponse(201, bookedAppointment, "Appointment booked successfully and is pending confirmation.")
    );
});

const getUserAppointments = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const role = req.user.role;
    const { status, page = 1, limit = 10 } = req.query;

    let query = {};
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: { "slot.date": -1, "slot.startTime": -1 },
        populate: [
            { path: 'patient', populate: { path: 'user', select: 'fullName email' } },
            { path: 'doctor', populate: { path: 'user', select: 'fullName email' } },
        ]
    };

    if (status) {
        query.status = status;
    }

    if (role === 'patient') {
        const patientProfile = await Patient.findOne({ user: userId }).select('_id');
        if (!patientProfile) return res.status(200).json(new ApiResponse(200, { docs: [], totalDocs: 0 }, "No patient profile found."));
        query.patient = patientProfile._id;
    } else if (role === 'doctor') {
        const doctorProfile = await Doctor.findOne({ user: userId }).select('_id');
        if (!doctorProfile) return res.status(200).json(new ApiResponse(200, { docs: [], totalDocs: 0 }, "No doctor profile found."));
        query.doctor = doctorProfile._id;
    } else if (role !== 'admin') {
       
        return res.status(403).json(new ApiResponse(403, {}, "Unauthorized role to view appointments."));
    }

    const appointments = await Appointment.paginate(query, options);

    return res.status(200).json(
        new ApiResponse(200, appointments, "Appointments fetched successfully.")
    );
});
const updateAppointmentStatus = asyncHandler(async (req, res) => {
    const appointmentId = req.params.id;
    const { status } = req.body;
    const userId = req.user._id;
    const role = req.user.role;

    if (!status || !['confirmed', 'cancelled', 'completed'].includes(status.toLowerCase())) {
        throw new ApiError(400, "Invalid or missing status. Must be confirmed, cancelled, or completed.");
    }

    const appointment = await Appointment.findById(appointmentId).populate('doctor');

    if (!appointment) {
        throw new ApiError(404, "Appointment not found.");
    }
    let authorized = role === 'admin';
    if (role === 'doctor') {
        const doctorProfile = await Doctor.findOne({ user: userId });
        if (doctorProfile && appointment.doctor._id.equals(doctorProfile._id)) {
            authorized = true;
        }
    }

    if (!authorized) {
        throw new ApiError(403, "Unauthorized to change the status of this appointment.");
    }

    if (status === 'completed' && appointment.status !== 'confirmed') {
        throw new ApiError(400, "Cannot complete an appointment that is not confirmed.");
    }
    if (status === 'confirmed' && appointment.status !== 'pending') {
        throw new ApiError(400, "Can only confirm a pending appointment.");
    }
    
    const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        { $set: { status: status.toLowerCase() } },
        { new: true }
    );

    const finalAppointment = await getPopulatedAppointment(updatedAppointment._id);

    return res.status(200).json(
        new ApiResponse(200, finalAppointment, `Appointment status updated to ${status}.`)
    );
});


const cancelAppointment = asyncHandler(async (req, res) => {
    const appointmentId = req.params.id;
    const userId = req.user._id;
    const role = req.user.role;

    const appointment = await Appointment.findById(appointmentId).populate(['patient', 'doctor']);

    if (!appointment) {
        throw new ApiError(404, "Appointment not found.");
    }

    let authorized = role === 'admin';
    const patientProfile = await Patient.findOne({ user: userId });
    if (patientProfile && appointment.patient._id.equals(patientProfile._id)) {
        authorized = true;
    }

    const doctorProfile = await Doctor.findOne({ user: userId });
    if (doctorProfile && appointment.doctor._id.equals(doctorProfile._id)) {
        authorized = true;
    }

    if (!authorized) {
        throw new ApiError(403, "Unauthorized to cancel this appointment.");
    }

    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
        throw new ApiError(400, `Cannot cancel an appointment that is already ${appointment.status}.`);
    }
    const cancelledAppointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        { $set: { status: 'cancelled' } },
        { new: true }
    );
    
    return res.status(200).json(
        new ApiResponse(200, cancelledAppointment, "Appointment cancelled successfully.")
    );
});

export {
    bookAppointment,
    getUserAppointments,
    updateAppointmentStatus,
    cancelAppointment,
};