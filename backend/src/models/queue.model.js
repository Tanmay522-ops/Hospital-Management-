import mongoose, { Schema } from "mongoose";

const queueSchema = new Schema(
  {
    doctor: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    patient: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    position: {
      type: Number,
      required: true,
    },
    estimatedTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["waiting", "in-progress", "completed"],
      default: "waiting",
    },
  },
  { timestamps: true }
);

export const Queue = mongoose.model("Queue", queueSchema);
