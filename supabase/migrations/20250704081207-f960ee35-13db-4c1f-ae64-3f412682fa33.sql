
-- Update auth configuration to set password reset token expiration to 4 hours (14400 seconds)
UPDATE auth.config 
SET password_reset_token_validity_period = 14400 
WHERE instance_id = '00000000-0000-0000-0000-000000000000';

-- Also ensure email confirmation token has reasonable expiration
UPDATE auth.config 
SET email_confirm_token_validity_period = 14400 
WHERE instance_id = '00000000-0000-0000-0000-000000000000';
