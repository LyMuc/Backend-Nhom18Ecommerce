import UserModel from '../models/user.model.js'
import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import sendEmailFunction from '../config/sendEmail.js'
import VerificationEmail from '../utils/verifyEmailTemplate.js'
import generatedAccessToken from '../utils/generatedAccessToken.js';
import genertedRefreshToken from '../utils/generatedRefreshToken.js';
import cloudinary from '../config/cloudinaryConfig.js';
import fs from 'fs';
import ReviewModel from '../models/reviews.model.js.js';
import AddressModel from '../models/address.model.js'; // Import để populate hoạt động

// Cloudinary đã được cấu hình trong index.js

export async function registerUserController(req, res) {
    try {
        let user;

        const {name, email, password} = req.body;

        if(!name || !email || !password){
            return res.status(400).json({
                message: "All fields are required", 
                error: true, 
                success: false
            })
        }

        user = await UserModel.findOne({email: email});
        if(user){
            return res.status(400).json({
                message: "The email is already registered",
                error: true,
                success: false
            })
        }

        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcryptjs.genSalt(10);
        const hashPassword = await bcryptjs.hash(password, salt);

        user = new UserModel({
            email: email, 
            name: name, 
            password: hashPassword, 
            otp: verifyCode, 
            otpExpires: Date.now() + 10 * 60 * 1000 // 10 minutes
        })

        await user.save();

        const emailResult = await sendEmailFunction({
            to: email, 
            subject: "Verify email from Nhom18-Ecommerce", 
            text: "", 
            html: VerificationEmail(name, verifyCode)
        })

        if (!emailResult) {
            console.error('Failed to send verification email to:', email);
            // Vẫn trả về success vì user đã được tạo, chỉ email thất bại
            return res.status(200).json({
                success: true,
                error: false,
                message: "User registered successfully, but failed to send verification email. Please check your email settings.",
            })
        }

        // const token = jwt.sign({
        //     email: email,
        //     id: user._id
        // }, process.env.JSON_WEB_TOKEN_SECRET_KEY, {expiresIn: '1h'})

        return res.status(200).json({
            success: true,
            error: false,
            message: "User registered successfully! ",
            // token: token,
        })
    }
    catch (error){
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

export async function verifyEmailController(request, response) {
    try {
        const { email, otp } = request.body;

        // Tìm user theo email
        const user = await UserModel.findOne({ email: email });
        if (!user) {
            return response.status(400).json({ 
                error: true, 
                success: false, 
                message: "User not found" 
            });
        }

        // Kiểm tra OTP có đúng không
        const isCodeValid = user.otp === otp;
        
        // Kiểm tra OTP còn hiệu lực không
        const isNotExpired = user.otpExpires > Date.now();

        if (isCodeValid && isNotExpired) {
            // OTP đúng và còn hạn → Xác thực thành công
            user.verify_email = true;
            user.otp = null;
            user.otpExpires = null;
            await user.save();
            
            return response.status(200).json({ 
                error: false, 
                success: true, 
                message: "Email verified successfully" 
            });
        } else if (!isCodeValid) {
            // OTP sai
            return response.status(400).json({ 
                error: true, 
                success: false, 
                message: "Invalid OTP" 
            });
        } else {
            // OTP hết hạn
            return response.status(400).json({ 
                error: true, 
                success: false, 
                message: "OTP expired" 
            });
        }

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

export async function loginUserController(request, response) {
    try {
        const { email, password } = request.body;

        // Tìm user theo email
        const user = await UserModel.findOne({ email: email });

        if (!user) {
            return response.status(400).json({
                message: "User not registered",
                error: true,
                success: false
            })
        }

        // Kiểm tra trạng thái tài khoản
        if (user.status !== "Active") {
            return response.status(400).json({
                message: "Contact to admin",
                error: true,
                success: false
            })
        }

        // Kiểm tra email đã xác thực chưa
        if (user.verify_email !== true) {
            return response.status(400).json({
                message: "Your Email is not verify yet please verify your email first",
                error: true,
                success: false
            })
        }

        // So sánh password
        const checkPassword = await bcryptjs.compare(password, user.password);

        if (!checkPassword) {
            return response.status(400).json({
                message: "Check your password",
                error: true,
                success: false
            })
        }

        // Tạo access token và refresh token
        const accesstoken = await generatedAccessToken(user._id);
        const refreshToken = await genertedRefreshToken(user._id);

        // Cập nhật last_login_date
        const updateUser = await UserModel.findByIdAndUpdate(user?._id, {
            last_login_date: new Date()
        })

        // Set cookie
        const cookiesOption = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // true trong production
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // 'None' cho cross-site
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        }
        response.cookie('accessToken', accesstoken, cookiesOption)
        response.cookie('refreshToken', refreshToken, cookiesOption)

        // Trả về response
        return response.json({
            message: "Login successfully",
            error: false,
            success: true,
            data: {
                accesstoken,
                refreshToken
            }
        })
    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

export async function adminLoginUserController(request, response) {
    try {
        const { email, password } = request.body;

        const user = await UserModel.findOne({ email: email });

        if (!user) {
            return response.status(400).json({
                message: "User not registered",
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

        if (user.status !== "Active") {
            return response.status(400).json({
                message: "Contact to admin",
                error: true,
                success: false
            })
        }

        if (user.verify_email !== true) {
            return response.status(400).json({
                message: "Your Email is not verify yet please verify your email first",
                error: true,
                success: false
            })
        }

        const checkPassword = await bcryptjs.compare(password, user.password);

        if (!checkPassword) {
            return response.status(400).json({
                message: "Check your password",
                error: true,
                success: false
            })
        }

        const accesstoken = await generatedAccessToken(user._id);
        const refreshToken = await genertedRefreshToken(user._id);

        await UserModel.findByIdAndUpdate(user?._id, {
            last_login_date: new Date()
        })

        const cookiesOption = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        }

        response.cookie('accessToken', accesstoken, cookiesOption)
        response.cookie('refreshToken', refreshToken, cookiesOption)

        return response.json({
            message: "Login successfully",
            error: false,
            success: true,
            data: {
                accesstoken,
                refreshToken
            }
        })
    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

export async function authWithGoogle(request, response) {
    const { name, email, password, avatar, mobile, role } = request.body;

    try {
        // Kiểm tra user đã tồn tại chưa
        const existingUser = await UserModel.findOne({ email: email });

        // TH1: User chưa tồn tại → Tạo mới
        if (!existingUser) {
            const user = await UserModel.create({
                name: name,
                mobile: mobile,
                email: email,
                password: "null",
                avatar: avatar,
                role: role,
                verify_email: true,  // Google đã verify email rồi
                signUpWithGoogle: true
            });

            await user.save();

            // Tạo token
            const accesstoken = await generatedAccessToken(user._id);
            const refreshToken = await genertedRefreshToken(user._id);

            // Cập nhật last_login_date
            await UserModel.findByIdAndUpdate(user?._id, {
                last_login_date: new Date()
            })

            // Set cookie
            const cookiesOption = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            }
            response.cookie('accessToken', accesstoken, cookiesOption)
            response.cookie('refreshToken', refreshToken, cookiesOption)

            return response.json({
                message: "Login successfully",
                error: false,
                success: true,
                data: {
                    accesstoken,
                    refreshToken
                }
            })

        } 
        // TH2: User đã tồn tại → Chỉ cần login
        else {
            // Tạo token mới
            const accesstoken = await generatedAccessToken(existingUser._id);
            const refreshToken = await genertedRefreshToken(existingUser._id);

            // Cập nhật last_login_date
            await UserModel.findByIdAndUpdate(existingUser?._id, {
                last_login_date: new Date()
            })

            // Set cookie
            const cookiesOption = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            }
            response.cookie('accessToken', accesstoken, cookiesOption)
            response.cookie('refreshToken', refreshToken, cookiesOption)

            return response.json({
                message: "Login successfully",
                error: false,
                success: true,
                data: {
                    accesstoken,
                    refreshToken
                }
            })
        }

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

// API check authentication từ cookie
export async function checkAuthController(request, response) {
    try {
        const userId = request.userId; // Từ middleware auth

        const user = await UserModel.findById(userId);

        if (!user) {
            return response.status(404).json({
                message: "User not found",
                error: true,
                success: false
            })
        }

        return response.json({
            message: "User authenticated",
            error: false,
            success: true,
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

export async function forgotPasswordController(request, response) {
    try {
        const { email } = request.body

        // Tìm user theo email
        const user = await UserModel.findOne({ email: email })

        if (!user) {
            return response.status(400).json({
                message: "Email not available",
                error: true,
                success: false
            })
        }

        else {
            // Tạo OTP 6 chữ số
            let verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

            // Lưu OTP vào user
            user.otp = verifyCode;
            user.otpExpires = Date.now() + 600000;  // 10 phút

            await user.save();

            // Gửi email chứa OTP
            await sendEmailFunction({
                to: email,
                subject: "Verify OTP for Reset Password from Nhom18-Ecommerce App",
                text: "",
                html: VerificationEmail(user.name, verifyCode)
            })

            return response.json({
                message: "check your email",
                error: false,
                success: true
            })
        }

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

// Verify Forgot Password OTP
export async function verifyForgotPasswordOtp(request, response) {
    try {
        const { email, otp } = request.body;

        const user = await UserModel.findOne({ email: email })

        console.log(user)

        if (!user) {
            return response.status(400).json({
                message: "Email not available",
                error: true,
                success: false
            })
        }

        if (!email || !otp) {
            return response.status(400).json({
                message: "Provide required field email, otp.",
                error: true,
                success: false
            })
        }

        // Kiểm tra OTP có đúng không
        if (otp !== user.otp) {
            return response.status(400).json({
                message: "Invailid OTP",
                error: true,
                success: false
            })
        }

        // Kiểm tra OTP có hết hạn chưa
        const currentTime = new Date().toISOString()

        if (user.otpExpires < currentTime) {
            return response.status(400).json({
                message: "Otp is expired",
                error: true,
                success: false
            })
        }

        // Xóa OTP sau khi verify thành công
        user.otp = "";
        user.otpExpires = "";

        await user.save();

        return response.status(200).json({
            message: "Verify OTP successfully",
            error: false,
            success: true
        })
    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

//Reset password for admin
export async function resetpassword(request, response) {
    try {
        const { email, oldPassword, newPassword, confirmPassword } = request.body;
        
        if (!email || !newPassword || !confirmPassword) {
            return response.status(400).json({
                error: true,
                success: false,
                message: "provide required fields email, newPassword, confirmPassword"
            })
        }

        const user = await UserModel.findOne({ email });
        
        if (!user) {
            return response.status(400).json({
                message: "Email is not available",
                error: true,
                success: false
            })
        }

        
        const checkPassword = await bcryptjs.compare(oldPassword, user.password);
        if (!checkPassword) {
            return response.status(400).json({
                message: "your old password is wrong",
                error: true,
                success: false,
            })
        }

        // Kiểm tra password khớp nhau không
        if (newPassword !== confirmPassword) {
            return response.status(400).json({
                message: "newPassword and confirmPassword must be same.",
                error: true,
                success: false,
            })
        }

        // Hash password mới
        const salt = await bcryptjs.genSalt(10);
        const hashPassword = await bcryptjs.hash(confirmPassword, salt);

        user.password = hashPassword;
        user.signUpWithGoogle = false;
        await user.save();

        return response.json({
            message: "Password updated successfully.",
            error: false,
            success: true
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

//Change Password
export async function changePasswordController(request, response) {
    try {
        const { email, newPassword, confirmPassword } = request.body;
        
        if (!email || !newPassword || !confirmPassword) {
            return response.status(400).json({
                error: true,
                success: false,
                message: "provide required fields email, newPassword, confirmPassword"
            })
        }

        const user = await UserModel.findOne({ email });
        
        if (!user) {
            return response.status(400).json({
                message: "Email is not available",
                error: true,
                success: false
            })
        }

        // Kiểm tra password khớp nhau không
        if (newPassword !== confirmPassword) {
            return response.status(400).json({
                message: "newPassword and confirmPassword must be same.",
                error: true,
                success: false,
            })
        }

        // Hash password mới
        const salt = await bcryptjs.genSalt(10);
        const hashPassword = await bcryptjs.hash(confirmPassword, salt);

        user.password = hashPassword;
        user.signUpWithGoogle = false;  // Reset flag Google
        await user.save();

        return response.json({
            message: "Password updated successfully.",
            error: false,
            success: true
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

// Logout
export async function logoutController(request, response) {
    try {
        // Xóa cookie
        const cookiesOption = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        }

        response.clearCookie('accessToken', cookiesOption);
        response.clearCookie('refreshToken', cookiesOption);

        return response.json({
            message: "Logout successfully",
            error: false,
            success: true
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

//Get user's details
export async function userDetails(request, response) {
    try {
        const userId = request.userId  // Lấy từ auth middleware
        console.log('=== userDetails ===');
        console.log('userId:', userId);

        // Tìm user và loại bỏ password, refresh_token
        // Populate address_details để lấy thông tin địa chỉ
        const user = await UserModel.findById(userId)
            .select('-password -refresh_token')
            .populate('address_details')

        console.log('user found:', user ? 'yes' : 'no');

        return response.json({
            message: 'user details',
            data: user,
            error: false,
            success: true
        })
    } catch (error) {
        console.log('userDetails error:', error.message);
        return response.status(500).json({
            message: "Something is wrong",
            error: true,
            success: false
        })
    }
}

//Update user's details
//api/users/:id
export async function updateUserDetails(request, response) {
    try {
        const userId = request.userId //auth middleware
        const { name, email, mobile, password } = request.body;

        // Kiểm tra user có tồn tại không
        const userExist = await UserModel.findById(userId);
        if (!userExist)
            return response.status(400).send('The user cannot be Updated!');

        // Cập nhật user
        const updateUser = await UserModel.findByIdAndUpdate(
            userId,
            {
                name: name,
                mobile: mobile,
                email: email,
            },
            { new: true }  // Trả về document đã update
        )

        return response.json({
            message: "User Updated successfully",
            error: false,
            success: true,
            user: {
                name: updateUser?.name,
                _id: updateUser?._id,
                email: updateUser?.email,
                mobile: updateUser?.mobile,
                avatar: updateUser?.avatar
            }
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

//image upload
var imagesArr = [];
export async function userAvatarController(request, response) {
    try {
        imagesArr = [];

        const userId = request.userId;  //auth middleware
        const image = request.files;

        console.log('=== userAvatarController START ===');
        console.log('userId:', userId);
        console.log('files:', image);

        const user = await UserModel.findOne({ _id: userId });

        if (!user) {
            return response.status(500).json({
                message: "User not found",
                error: true,
                success: false
            })
        }

        // Chỉ xóa ảnh cũ từ Cloudinary nếu user đã có avatar
        const imgUrl = user.avatar;
        if (imgUrl && imgUrl.includes('cloudinary')) {
            const urlArr = imgUrl.split("/");
            const avatar_image = urlArr[urlArr.length - 1];
            const imageName = avatar_image.split(".")[0];

            if (imageName) {
                try {
                    await cloudinary.uploader.destroy(imageName);
                    console.log('Old avatar deleted from Cloudinary:', imageName);
                } catch (err) {
                    console.log('Error deleting old avatar:', err.message);
                }
            }
        }

        const options = {
            use_filename: true,
            unique_filename: false,
            overwrite: false,
            folder: 'ecommerce/avatars', // Thêm folder để quản lý tốt hơn
        };

        // Upload ảnh lên Cloudinary
        for (let i = 0; i < image?.length; i++) {
            try {
                console.log('Uploading to Cloudinary:', image[i].path);
                
                const result = await cloudinary.uploader.upload(
                    image[i].path,
                    options
                );
                
                console.log('Upload successful:', result.secure_url);
                imagesArr.push(result.secure_url);
                
                // Xóa file tạm
                fs.unlinkSync(image[i].path);
            } catch (uploadError) {
                console.log('Cloudinary upload error:', uploadError.message);
                console.log('Full error:', uploadError);
                // Xóa file tạm dù upload fail
                if (fs.existsSync(image[i].path)) {
                    fs.unlinkSync(image[i].path);
                }
                throw uploadError; // Re-throw để catch ở ngoài
            }
        }

        user.avatar = imagesArr[0];
        await user.save();

        return response.status(200).json({
            message: "Avatar updated successfully",
            error: false,
            success: true,
            _id: userId,
            avtar: imagesArr[0]
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

export async function removeImageFromCloudinary(request, response) {
    const imgUrl = request.query.img;

    const urlArr = imgUrl.split("/");
    const image = urlArr[urlArr.length - 1];

    const imageName = image.split(".")[0];

    if (imageName) {
        const res = await cloudinary.uploader.destroy(
            imageName,
            (error, result) => {
                // console.log(error, res)
            }
        );

        if (res) {
            response.status(200).send(res);
        }
    }

}

//refresh token controler
export async function refreshToken(request, response) {
    try {
        const refreshToken = request.cookies.refreshToken || request?.headers?.authorization?.split(" ")[1]  /// [ Bearer token]

        if (!refreshToken) {
            return response.status(401).json({
                message: "Invalid token",
                error: true,
                success: false
            })
        }


        const verifyToken = await jwt.verify(refreshToken, process.env.SECRET_KEY_REFRESH_TOKEN)
        if (!verifyToken) {
            return response.status(401).json({
                message: "token is expired",
                error: true,
                success: false
            })
        }

        const userId = verifyToken?._id;
        const newAccessToken = await generatedAccessToken(userId)

        const cookiesOption = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        }

        response.cookie('accessToken', newAccessToken, cookiesOption)

        return response.json({
            message: "New Access token generated",
            error: false,
            success: true,
            data: {
                accessToken: newAccessToken
            }
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

//review controller
export async function addReview(request, response) {
    try {

        const {image, userName, review, rating, userId, productId} = request.body;

        const userReview = new ReviewModel({
            image:image,
            userName:userName,
            review:review,
            rating:rating,
            userId:userId,
            productId:productId
        })


        await userReview.save();

        return response.json({
            message: "Review added successfully",
            error: false,
            success: true
        })
        
    } catch (error) {
        return response.status(500).json({
            message: "Something is wrong",
            error: true,
            success: false
        })
    }
}

//get reviews
export async function getReviews(request, response) {
    try {

        const productId = request.query.productId;
       

        const reviews = await ReviewModel.find({productId:productId});
        console.log(reviews)

        if(!reviews){
            return response.status(400).json({
                error: true,
                success: false
            })
        }

        return response.status(200).json({
            error: false,
            success: true,
            reviews:reviews
        })
        
    } catch (error) {
        return response.status(500).json({
            message: "Something is wrong",
            error: true,
            success: false
        })
    }
}




//get all reviews
export async function getAllReviews(request, response) {
    try {      

        const reviews = await ReviewModel.find();

        if(!reviews){
            return response.status(400).json({
                error: true,
                success: false
            })
        }

        return response.status(200).json({
            error: false,
            success: true,
            reviews:reviews
        })
        
    } catch (error) {
        return response.status(500).json({
            message: "Something is wrong",
            error: true,
            success: false
        })
    }
}


//get all users
export async function getAllUsers(request, response) {
    try {
        const { page, limit } = request.query;

        const totalUsers = await UserModel.find();

        const users = await UserModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));

        const total = await UserModel.countDocuments(users);

        if(!users){
            return response.status(400).json({
                error: true,
                success: false
            })
        }

        return response.status(200).json({
            error: false,
            success: true,
            users:users,
            total: total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalUsersCount:totalUsers?.length,
            totalUsers:totalUsers
        })
        
    } catch (error) {
        return response.status(500).json({
            message: "Something is wrong",
            error: true,
            success: false
        })
    }
}



export async function deleteUser(request, response) {
    // Prevent deleting yourself (even if you're admin)
    if (String(request.params.id) === String(request.userId)) {
        return response.status(400).json({
            message: "You cannot delete your own account",
            error: true,
            success: false
        })
    }

    const user = await UserModel.findById(request.params.id);

    if (!user) {
        return response.status(404).json({
            message: "User Not found",
            error: true,
            success: false
        })
    }


    const deletedUser = await UserModel.findByIdAndDelete(request.params.id);

    if (!deletedUser) {
        response.status(404).json({
            message: "User not deleted!",
            success: false,
            error: true
        });
    }

    return response.status(200).json({
        success: true,
        error: false,
        message: "User Deleted!",
    });
}


// Admin: update user's role
// PUT /api/users/admin/update-role/:id
export async function updateUserRole(request, response) {
    try {
        const targetUserId = request.params.id;
        const { role } = request.body;

        const allowedRoles = ['ADMIN', 'USER'];
        if (!role || !allowedRoles.includes(role)) {
            return response.status(400).json({
                message: 'Invalid role',
                error: true,
                success: false
            })
        }

        // Prevent locking the current admin out
        if (String(targetUserId) === String(request.userId) && role !== 'ADMIN') {
            return response.status(400).json({
                message: 'You cannot remove your own admin role',
                error: true,
                success: false
            })
        }

        const user = await UserModel.findById(targetUserId);
        if (!user) {
            return response.status(404).json({
                message: 'User not found',
                error: true,
                success: false
            })
        }

        user.role = role;
        await user.save();

        return response.status(200).json({
            message: 'User role updated',
            error: false,
            success: true,
            data: {
                _id: user._id,
                role: user.role
            }
        })
    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}


//delete multiple products
export async function deleteMultiple(request, response) {
    const { ids } = request.body;

    if (!ids || !Array.isArray(ids)) {
        return response.status(400).json({ error: true, success: false, message: 'Invalid input' });
    }


    // Prevent deleting yourself
    if (ids.some((id) => String(id) === String(request.userId))) {
        return response.status(400).json({
            message: "You cannot delete your own account",
            error: true,
            success: false
        })
    }

    try {
        await UserModel.deleteMany({ _id: { $in: ids } });
        return response.status(200).json({
            message: "Users delete successfully",
            error: false,
            success: true
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }

}