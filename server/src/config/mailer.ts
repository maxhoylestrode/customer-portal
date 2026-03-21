import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const FROM = process.env.SMTP_FROM || 'Apex Studio Codes <support@apexstudiocodes.co.uk>';
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'support@apexstudiocodes.co.uk';
