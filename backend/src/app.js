import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
const app = express()
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

// routes import 
import userRouter from "./routes/user.routes.js"
import doctorRouter from './routes/doctor.routes.js';
import patientRouter from './routes/patient.routes.js';
import appointmentRouter from './routes/appointment.routes.js';
import queueRouter from './routes/queue.routes.js';
import adminRouter from "./routes/admin.routes.js"
// routes declaration

app.use("/api/v1/users",userRouter)
app.use("/api/v1/doctors", doctorRouter);
app.use("/api/v1/patients", patientRouter);
app.use("/api/v1/appointments", appointmentRouter);
app.use("/api/v1/queue", queueRouter);
app.use("/api/v1/admin", adminRouter);

export { app }