import { GraphQLError } from "graphql";
import nodemailer from "nodemailer";

async function sendEmail(params) {
  if (!params) {
    throw new GraphQLError("sendEmail: params object is required");
  }
  
  const { to, subject, message, html, attachments, from } = params;
  
  const smtpUser =  "info@naduganda.org";
  const smtpPass = "ejgvK1CLF(?[";
  const sender = from || process.env.SMTP_FROM || smtpUser;

  try {
    if (!smtpUser || !smtpPass) {
      throw new GraphQLError("SMTP credentials are missing");
    }

    // create reusable transporter object using the default SMTP transport
    const transporter = nodemailer.createTransport({
      host: "naduganda.org",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    console.log("Sending mail");

    // Verify credentials/connection before sending to surface auth/network issues clearly.
    await transporter.verify();

    // send mail with defined transport object
    const info = await transporter.sendMail({
      from: sender, // sender address
      to, // list of receivers
      subject, // Subject line
      text: message, // plain text body
      html,
      attachments,
    });

    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error("Email send failure:", {
      message: error?.message,
      code: error?.code,
      response: error?.response,
      command: error?.command,
    });

    throw new GraphQLError("server error: Failed to send emails", {
      extensions: {
        code: "EMAIL_SEND_FAILED",
        reason: error?.message || "Unknown email error",
      },
    });
  }
}

// sendEmail('dakampereza.std@nkumbauniversity.ac.ug', '123456');
export default sendEmail;
