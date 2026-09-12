import { Resend } from 'resend'
import { AppError, AppErrorCode } from './error'

const otpTemplate = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verifikasi OTP - Cervana</title>
  <style>
    :root {
      --primary-color: #3b82f6;
    }
    body {
      font-family: Arial, sans-serif;
      background-color: #eff6ff;
      padding: 0;
      margin: 0;
    }
    .container {
      max-width: 480px;
      margin: 40px auto;
      padding: 30px;
      background-color: #ffffff;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
    }
    .logo {
      font-size: 26px;
      color: var(--primary-color);
      font-weight: bold;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .token-box {
      margin-top: 20px;
      padding: 12px 24px;
      background-color: #f1f5f9;
      border: 1px dashed #93c5fd;
      color: #1e40af;
      font-family: monospace;
      border-radius: 6px;
      display: inline-block;
      font-size: 22px;
      letter-spacing: 4px;
    }
    .note {
      font-size: 14px;
      color: #6b7280;
      margin-top: 10px;
    }
    .footer {
      margin-top: 30px;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Cervana</div>
    <div class="message">
      Hai <strong>{{USERNAME}}</strong>,<br />
      Berikut adalah kode OTP untuk verifikasi akun Anda:
    </div>
    <div class="token-box">{{TOKEN}}</div>
    <div class="note">
      Kode ini hanya berlaku selama <strong>1 hari</strong>. Jangan bagikan kepada siapa pun.
    </div>
    <div class="footer">
      Jika Anda tidak merasa melakukan permintaan ini, abaikan saja pesan ini.
    </div>
  </div>
</body>
</html>
`

// export async function sendOTPVerificationEmail({
//   to,
//   username,
//   token
// }: {
//   to: string
//   username: string
//   token: string
// }) {
//   try {
//     const resend = new Resend(process.env.RESEND_API_KEY)

//     const htmlContent = otpTemplate
//       .replace(/{{USERNAME}}/g, username)
//       .replace(/{{TOKEN}}/g, token)

//     const response = await resend.emails.send({
//       from: 'Cervana <noreply@email.cervana-lidm.unair.ac.id>',
//       to,
//       subject: 'OTP Verifikasi Akun Anda - Cervana',
//       html: htmlContent
//     })

//     if (response.error) {
//       throw new AppError('Email send failed', 500, AppErrorCode.EMAIL_SEND_FAILED)
//     }

//     return response
//   } catch (error) {
//     throw error
//   }
// }


export async function sendOTPVerificationEmail({
  to,
  username,
  token
}: {
  to: string
  username: string
  token: string
}) {
  const isDev =
    process.env.NODE_ENV === "development" ||
    process.env.OTP_DEV_MODE === "true"

  const htmlContent = otpTemplate
    .replace(/{{USERNAME}}/g, username)
    .replace(/{{TOKEN}}/g, token)

  // DEV MODE
  if (isDev) {
    console.log("===== DEV MODE (EMAIL MOCK) =====")
    console.log({ to, username, token })
    console.log("=================================")

    return {
      devMode: true,
      message: "Email not sent. Dev mode enabled.",
      to,
      token,
      html: htmlContent
    }
  }

  // PRODUCTION
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const response = await resend.emails.send({
      from: "Cervana <onboarding@resend.dev>", // ✔ aman & pasti jalan
      to,
      subject: "OTP Verifikasi Akun Anda - Cervana",
      html: htmlContent
    })

    if (response.error) {
      throw new AppError(
        "Email send failed",
        500,
        AppErrorCode.EMAIL_SEND_FAILED
      )
    }

    return response
  } catch (error) {
    throw error
  }
}
