import mongoose, { Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const doctorSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true 
        },
        specialization: {
            type: String,
            required: true,
            trim: true,
        },
        experience: {
            type: Number,
            default: 0,
        },
        
        // ⭐ CRITICAL VERIFICATION FIELDS ⭐
        registrationNumber: { 
            type: String,
            required: true, 
            unique: true,
            trim: true,
        },
        proofDocument: { 
            type: String, 
            required: true, 
        },
        isVerified: { 
            type: Boolean,
            default: false,
        },
        verificationStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        // ⭐ END VERIFICATION FIELDS ⭐

        availability: [
            {
                day: {
                    type: String,
                    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], 
                    required: true,
                },
                slots: [
                    {
                        start: {
                            type: String, 
                            required: true,
                        },
                        end: {
                            type: String, 
                            required: true,
                        },
                    },
                ],
            },
        ],
    },
    { timestamps: true }
);

doctorSchema.plugin(mongoosePaginate);
export const Doctor = mongoose.model("Doctor", doctorSchema);