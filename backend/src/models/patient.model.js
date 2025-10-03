import mongoose, { Schema } from "mongoose";

const patientSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    zipCode: {
      type: String,
      required: true,
      trim: true,
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
      trim: true,
    },
    medicalHistory: [
      {
        type: String,
        trim: true,
      },
    ],
    emergencyContact: {
      name: {
        type: String,
      },
      phone: {
        type: String,
        match: [/^\d{10}$/, "Invalid phone number"],
      },
    },
  },
  { timestamps: true }
);

export const Patient = mongoose.model("Patient", patientSchema);
