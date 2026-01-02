import jwt from 'jsonwebtoken';
import UserModel from '../models/user.model.js';

export const auth = async (request, response, next) => {
    try {
        // Lấy token từ cookie (ưu tiên access token)
        const accessToken = request.cookies.accessToken;
        const refreshToken = request.cookies.refreshToken;
        const token = accessToken || refreshToken;

        console.log('=== AUTH MIDDLEWARE ===');
        console.log('Cookies:', request.cookies);
        console.log('Token found:', token ? 'yes' : 'no');

        if (!token) {
            return response.status(401).json({
                message: "Please login",
                error: true,
                success: false
            })
        }

        // Verify token (đúng secret theo loại token)
        const secret = accessToken
            ? process.env.SECRET_KEY_ACCESS_TOKEN
            : process.env.SECRET_KEY_REFRESH_TOKEN;

        const decode = await jwt.verify(token, secret);

        console.log('Token decoded:', decode);

        if (!decode) {
            return response.status(401).json({
                message: "Unauthorized access",
                error: true,
                success: false
            })
        }

        // Lưu user id vào request
        request.userId = decode.id;

        next();

    } catch (error) {
        console.log('Auth error:', error.message);
        // Nếu token hết hạn hoặc không hợp lệ
        if (error.name === 'TokenExpiredError') {
            return response.status(401).json({
                message: "Token expired, please login again",
                error: true,
                success: false
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return response.status(401).json({
                message: "Invalid token, please login again",
                error: true,
                success: false
            });
        }
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

export const requireAdmin = async (request, response, next) => {
    try {
        const userId = request.userId;

        if (!userId) {
            return response.status(401).json({
                message: "Please login",
                error: true,
                success: false
            })
        }

        const user = await UserModel.findById(userId).select('role');

        if (!user) {
            return response.status(404).json({
                message: "User not found",
                error: true,
                success: false
            })
        }

        if (user.role !== 'ADMIN') {
            return response.status(403).json({
                message: "Admin access required",
                error: true,
                success: false
            })
        }

        next();
    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}
