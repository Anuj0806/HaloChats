import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;


export const sendOTPEmail = async (email, otp, name) => {
  const templateParams = {
    email: email,
    user: name,   // or "to_name", matching whatever your EmailJS template expects
    otp: otp
  };

  return await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    templateParams,
    {
      publicKey: PUBLIC_KEY,
    }
  );
};
