import { Router } from 'express'
import { 
    loginUserController, 
    adminLoginUserController,
    registerUserController, 
    verifyEmailController,
    authWithGoogle,
    checkAuthController,
    forgotPasswordController,
    verifyForgotPasswordOtp,
    changePasswordController, 
    resetpassword, 
    logoutController, 
    userDetails, 
    updateUserDetails, 
    userAvatarController, 
    removeImageFromCloudinary, 
    refreshToken, 
    addReview, 
    getReviews, 
    getAllReviews, 
    getAllUsers, 
    deleteMultiple, 
    deleteUser, 
    updateUserRole,
    
} from '../controllers/user.controller.js'
import { auth, requireAdmin } from '../middleware/auth.js';
import upload from '../middleware/multer.js';

const userRouter = Router();

userRouter.post('/register', registerUserController);
userRouter.post('/verifyEmail', verifyEmailController);
userRouter.post('/login', loginUserController);
userRouter.post('/admin/login', adminLoginUserController);
userRouter.post('/refresh-token',refreshToken)
userRouter.post('/authWithGoogle', authWithGoogle);
userRouter.post('/forgot-password/change-password', changePasswordController)
userRouter.post('/forgot-password', forgotPasswordController);
userRouter.post('/verify-forgot-password-otp', verifyForgotPasswordOtp);
userRouter.get('/check-auth', auth, checkAuthController); // Protected route
userRouter.get('/admin/check-auth', auth, requireAdmin, checkAuthController);
userRouter.put('/user-avatar',auth,upload.array('avatar'),userAvatarController);
userRouter.post('/logout', auth, logoutController);
userRouter.get('/user-details', auth, userDetails)
userRouter.get('/admin/user-details', auth, requireAdmin, userDetails)
userRouter.put('/:id', auth, updateUserDetails)
userRouter.post('/reset-password', resetpassword)
userRouter.post('/addReview',auth,addReview);
userRouter.get('/getReviews',getReviews);
userRouter.get('/getAllReviews',getAllReviews);
userRouter.get('/getAllUsers', auth, requireAdmin, getAllUsers);
userRouter.put('/admin/update-role/:id', auth, requireAdmin, updateUserRole);
userRouter.delete('/deleteMultiple', auth, requireAdmin, deleteMultiple);
userRouter.delete('/deleteUser/:id', auth, requireAdmin, deleteUser);
userRouter.delete('/deteleImage', auth, removeImageFromCloudinary);

export default userRouter;