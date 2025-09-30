import mongoose, { Schema } from "mongoose";

const patientSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    age: {
      type: Number,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    medicalHistory: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { timestamps: true }
);

export const Patient = mongoose.model("Patient", patientSchema);
