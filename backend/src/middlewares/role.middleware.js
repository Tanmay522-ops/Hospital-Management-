export const verifyRole = (allowedRoles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Access denied. Please log in."
        });
    }

    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
            success: false,
            message: "Forbidden: You do not have the required role for this action."
        });
    }
    next();
};