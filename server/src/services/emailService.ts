import { transporter, FROM, CLIENT_URL, ADMIN_EMAIL } from '../config/mailer';

const brandedEmail = (title: string, bodyHtml: string): string => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0D3040;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Apex Studio Codes</h1>
              <p style="margin:4px 0 0;color:#D6EAF8;font-size:13px;">Client Portal</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#0D3040;font-size:18px;">${title}</h2>
              ${bodyHtml}
              <hr style="margin:32px 0;border:none;border-top:1px solid #e8f0f7;">
              <p style="margin:0;color:#888;font-size:12px;">
                Apex Studio Codes &bull; apexstudiocodes.co.uk &bull; Somerset, UK
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export async function sendNewTicketNotification(
  ticketId: number,
  ticketTitle: string,
  clientName: string,
  clientEmail: string
) {
  const html = brandedEmail(
    'New Maintenance Ticket Submitted',
    `<p style="color:#4A4A4A;line-height:1.6;">A new support ticket has been submitted by <strong>${clientName}</strong> (${clientEmail}).</p>
    <table style="width:100%;margin:16px 0;background:#f4f8fb;border-radius:6px;padding:16px;border-left:4px solid #0D3040;">
      <tr><td style="color:#4A4A4A;"><strong>Ticket #${ticketId}:</strong> ${ticketTitle}</td></tr>
    </table>
    <a href="${CLIENT_URL}/admin/tickets/${ticketId}" style="display:inline-block;background:#0D3040;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">View Ticket</a>`
  );

  await transporter.sendMail({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New Ticket #${ticketId}: ${ticketTitle}`,
    html,
  });
}

export async function sendTicketStatusUpdate(
  to: string,
  clientName: string,
  ticketId: number,
  ticketTitle: string,
  newStatus: string
) {
  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    complete: 'Complete',
    out_of_scope: 'Out of Scope',
  };

  const html = brandedEmail(
    'Your Ticket Has Been Updated',
    `<p style="color:#4A4A4A;line-height:1.6;">Hi ${clientName},</p>
    <p style="color:#4A4A4A;line-height:1.6;">The status of your support ticket has been updated.</p>
    <table style="width:100%;margin:16px 0;background:#f4f8fb;border-radius:6px;padding:16px;border-left:4px solid #0D3040;">
      <tr><td style="color:#4A4A4A;padding-bottom:8px;"><strong>Ticket:</strong> #${ticketId} — ${ticketTitle}</td></tr>
      <tr><td style="color:#4A4A4A;"><strong>New Status:</strong> ${statusLabels[newStatus] || newStatus}</td></tr>
    </table>
    <a href="${CLIENT_URL}/tickets/${ticketId}" style="display:inline-block;background:#0D3040;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">View Ticket</a>`
  );

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Ticket Update: ${ticketTitle}`,
    html,
  });
}

export async function sendInviteEmail(to: string, inviteToken: string) {
  const link = `${CLIENT_URL}/register?invite=${inviteToken}`;
  const html = brandedEmail(
    "You've Been Invited to Apex Portal",
    `<p style="color:#4A4A4A;line-height:1.6;">You have been invited to access the Apex Studio Codes client portal, where you can submit and track website maintenance requests.</p>
    <p style="color:#4A4A4A;line-height:1.6;">Click the button below to create your account. This link is valid for <strong>48 hours</strong>.</p>
    <a href="${link}" style="display:inline-block;background:#0D3040;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">Create My Account</a>
    <p style="margin-top:24px;color:#888;font-size:13px;">Or copy this link into your browser:<br><span style="color:#1A5276;">${link}</span></p>`
  );

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Your Apex Portal Invitation',
    html,
  });
}

export async function sendPasswordResetEmail(to: string, clientName: string, resetToken: string) {
  const link = `${CLIENT_URL}/reset-password/${resetToken}`;
  const html = brandedEmail(
    'Password Reset Request',
    `<p style="color:#4A4A4A;line-height:1.6;">Hi ${clientName},</p>
    <p style="color:#4A4A4A;line-height:1.6;">A password reset has been requested for your Apex Portal account. Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.</p>
    <a href="${link}" style="display:inline-block;background:#0D3040;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">Reset My Password</a>
    <p style="margin-top:24px;color:#888;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
    <p style="color:#888;font-size:13px;">Or copy this link into your browser:<br><span style="color:#1A5276;">${link}</span></p>`
  );

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset Your Apex Portal Password',
    html,
  });
}
