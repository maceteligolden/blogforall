# Email Service Setup

The email service is used to send site invitation emails to users. It uses `nodemailer` for email delivery.

## Configuration

The email service can be configured using the following environment variables:

### Production Configuration (SMTP)

```env
SMTP_HOST=smtp.gmail.com          # Your SMTP server host
SMTP_PORT=587                     # SMTP port (587 for TLS, 465 for SSL)
SMTP_USER=your-email@gmail.com    # SMTP username/email
SMTP_PASSWORD=your-app-password   # SMTP password or app-specific password
SMTP_FROM=noreply@blogforall.com  # From email address (optional, defaults to SMTP_USER)
FRONTEND_URL=https://yourdomain.com  # Frontend URL for invitation links
```

### Development Configuration

In development mode, if SMTP is not configured, the service will:
- Log emails to the console instead of sending them
- Use Ethereal Email (test account) if available for email previews

### Example Providers

#### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password  # Generate from Google Account settings
SMTP_FROM=noreply@blogforall.com
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@blogforall.com
```

#### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASSWORD=your-mailgun-password
SMTP_FROM=noreply@blogforall.com
```

#### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-aws-access-key-id
SMTP_PASSWORD=your-aws-secret-access-key
SMTP_FROM=noreply@blogforall.com
```

## How It Works

1. When a site invitation is created, the `SiteInvitationService` calls `sendInvitationEmail()`
2. The email service generates an HTML email with:
   - Inviter's name
   - Site name
   - Role assigned
   - Expiration date/time
   - Accept invitation button/link
3. The email is sent to the invited user's email address
4. If email sending fails, it's logged but doesn't prevent invitation creation

## Email Template

The invitation email includes:
- **Subject**: "You've been invited to collaborate on [Site Name]"
- **Content**: 
  - Inviter name
  - Site name
  - Assigned role
  - Expiration information
  - Accept button with invitation token link
  - Plain text fallback

## Testing

### Without SMTP (Development)
- Emails will be logged to console
- No actual emails will be sent
- Check logs for email content

### With Ethereal Email (Development)
- Automatically creates a test account
- Provides preview URLs in logs
- Useful for testing email templates

### With SMTP (Production)
- Configure environment variables
- Test by creating an invitation
- Check email inbox for received emails

## Troubleshooting

### Emails not sending
1. Check environment variables are set correctly
2. Verify SMTP credentials are valid
3. Check firewall/network allows SMTP connections
4. Review application logs for error messages

### Email delivery issues
1. Check spam/junk folder
2. Verify sender email domain has proper SPF/DKIM records
3. Ensure SMTP port is not blocked
4. Check provider-specific rate limits

## Security Notes

- Never commit SMTP credentials to version control
- Use app-specific passwords for Gmail
- Rotate credentials regularly
- Use environment variables for all sensitive data
