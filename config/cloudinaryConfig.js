import { v2 as cloudinary } from 'cloudinary';

// Hàm này sẽ được gọi SAU khi dotenv.config() đã chạy
export const configureCloudinary = () => {
    cloudinary.config({
        cloud_name: process.env.cloudinary_Config_Cloud_Name,
        api_key: process.env.cloudinary_Config_api_key,
        api_secret: process.env.cloudinary_Config_api_secret,
        secure: true,
    });
    
    console.log('Cloudinary configured with cloud_name:', process.env.cloudinary_Config_Cloud_Name);
};

export default cloudinary;
