
-- First, let's check if we can update the auth configuration through the auth schema
-- Set password reset token validity to 4 hours (14400 seconds) using the correct approach
ALTER DATABASE postgres SET "app.settings.auth_password_reset_token_validity_period" = '14400';

-- Also set email confirmation token validity to 4 hours
ALTER DATABASE postgres SET "app.settings.auth_email_confirm_token_validity_period" = '14400';

-- Set timezone to Philippines (Asia/Manila) for consistent time handling
ALTER DATABASE postgres SET timezone = 'Asia/Manila';
