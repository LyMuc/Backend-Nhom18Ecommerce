import { sendEmail } from "./emailService.js";

const sendEmailFunction = async ({to, subject, text, html}) => {
    console.log(to);
    const result = await sendEmail(to, subject, text, html);
    if(result.success){
        return true;
    }
    else{
        return false;
    }
}

export default sendEmailFunction;