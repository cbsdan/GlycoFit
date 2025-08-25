from flask_mail import Mail, Message
from flask import current_app
import os
import logging
from datetime import datetime
import random

# Global mail instance
mail = None

def init_mail(app):
    """Initialize Flask-Mail with the app"""
    global mail
    
    # Configure Flask-Mail
    app.config['MAIL_SERVER'] = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    app.config['MAIL_PORT'] = int(os.getenv('SMTP_PORT', 465))
    app.config['MAIL_USE_SSL'] = True
    app.config['MAIL_USE_TLS'] = False
    app.config['MAIL_USERNAME'] = os.getenv('SMTP_EMAIL')
    app.config['MAIL_PASSWORD'] = os.getenv('SMTP_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = (
        os.getenv('SMTP_FROM_NAME', 'GlycoFit'),
        os.getenv('SMTP_FROM_EMAIL', os.getenv('SMTP_EMAIL'))
    )
    
    mail = Mail(app)
    logging.info("Flask-Mail initialized successfully")

def send_email(to_email, subject, html_content, text_content=None):
    """Send email using Flask-Mail"""
    try:
        if not mail:
            raise Exception("Mail service not initialized")
        
        msg = Message(
            subject=subject,
            recipients=[to_email],
            html=html_content,
            body=text_content
        )
        
        mail.send(msg)
        logging.info(f"Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        logging.error(f"Failed to send email to {to_email}: {str(e)}")
        raise e

def generate_otp(length=5):
    """Generate OTP of specified length"""
    return str(random.randint(10**(length-1), 10**length - 1))

def create_otp_email_template(otp, purpose="verification"):
    """Create HTML email template for OTP"""
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c5530; margin: 0; font-size: 28px;">GlycoFit</h1>
            <p style="color: #666; margin: 5px 0; font-size: 16px;">Diabetes Management Made Simple</p>
            <div style="height: 4px; background: linear-gradient(to right, #2c5530, #4a7c59); margin: 15px auto; width: 100px; border-radius: 2px;"></div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #2c5530; margin: 0 0 15px 0; text-align: center;">Email Verification</h2>
            <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px 0;">
                Thank you for choosing GlycoFit. Please use the following One-Time Password (OTP) to complete your {purpose}:
            </p>
            
            <div style="text-align: center; margin: 25px 0;">
                <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 20px; background-color: #ffffff; border: 2px solid #2c5530; border-radius: 8px; color: #2c5530; display: inline-block;">
                    {otp}
                </div>
                <p style="color: #888; font-size: 14px; margin-top: 15px;">This OTP will expire in 10 minutes.</p>
            </div>
        </div>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #2c5530; margin: 0 0 10px 0; font-size: 18px;">Why GlycoFit?</h3>
            <ul style="color: #555; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li>Track blood glucose levels effortlessly</li>
                <li>Monitor your diabetes management progress</li>
                <li>Get personalized insights and recommendations</li>
                <li>Secure, private, and HIPAA-compliant platform</li>
            </ul>
        </div>
        
        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e0e0e0; color: #888; font-size: 14px;">
            <p style="margin: 0 0 10px 0;">If you didn't request this OTP, please ignore this email.</p>
            <p style="margin: 0;">Need help? Contact our support team.</p>
            <p style="margin: 15px 0 0 0; font-weight: bold;">&copy; {datetime.now().year} GlycoFit. All rights reserved.</p>
        </div>
    </div>
    """

def create_welcome_email_template(user_name):
    """Create welcome email template"""
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2c5530; margin: 0; font-size: 28px;">Welcome to GlycoFit!</h1>
            <div style="height: 4px; background: linear-gradient(to right, #2c5530, #4a7c59); margin: 15px auto; width: 150px; border-radius: 2px;"></div>
        </div>
        
        <div style="margin-bottom: 25px;">
            <h2 style="color: #2c5530; margin: 0 0 15px 0;">Hello {user_name},</h2>
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
                Congratulations! Your GlycoFit account has been successfully created. You're now part of a community dedicated to better diabetes management.
            </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #2c5530; margin: 0 0 15px 0;">What's Next?</h3>
            <ul style="color: #555; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Complete your profile setup in the app</li>
                <li>Start logging your blood glucose readings</li>
                <li>Set your target glucose ranges</li>
                <li>Explore our tracking and analysis features</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
            <p style="color: #555; font-size: 16px; margin: 0 0 15px 0;">Ready to take control of your diabetes management?</p>
            <div style="background-color: #2c5530; color: white; padding: 15px 30px; border-radius: 6px; display: inline-block; text-decoration: none; font-weight: bold;">
                Get Started with GlycoFit
            </div>
        </div>
        
        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e0e0e0; color: #888; font-size: 14px;">
            <p style="margin: 0 0 10px 0;">Need help getting started? Our support team is here to help.</p>
            <p style="margin: 15px 0 0 0; font-weight: bold;">&copy; {datetime.now().year} GlycoFit. All rights reserved.</p>
        </div>
    </div>
    """

# OTP Storage (in production, use Redis or database)
otp_store = {}

class OTPService:
    @staticmethod
    def generate_and_store_otp(email, purpose="verification", length=5, expires_in_minutes=10):
        """Generate OTP and store with expiration"""
        otp = generate_otp(length)
        expires_at = datetime.now().timestamp() + (expires_in_minutes * 60)
        
        otp_store[email] = {
            'otp': otp,
            'purpose': purpose,
            'expires_at': expires_at,
            'attempts': 0,
            'max_attempts': 3
        }
        
        logging.info(f"OTP generated for {email} - Purpose: {purpose}")
        return otp
    
    @staticmethod
    def verify_otp(email, otp):
        """Verify OTP"""
        stored_data = otp_store.get(email)
        
        if not stored_data:
            return False, "OTP not found or expired"
        
        # Check expiration
        if datetime.now().timestamp() > stored_data['expires_at']:
            del otp_store[email]
            return False, "OTP has expired"
        
        # Check attempts
        if stored_data['attempts'] >= stored_data['max_attempts']:
            del otp_store[email]
            return False, "Maximum verification attempts exceeded"
        
        # Verify OTP
        if stored_data['otp'] != otp:
            stored_data['attempts'] += 1
            return False, f"Invalid OTP. {stored_data['max_attempts'] - stored_data['attempts']} attempts remaining"
        
        # Success - clean up
        purpose = stored_data['purpose']
        del otp_store[email]
        return True, f"{purpose} successful"
    
    @staticmethod
    def send_otp_email(email, purpose="verification"):
        """Generate and send OTP via email"""
        try:
            otp = OTPService.generate_and_store_otp(email, purpose)
            html_content = create_otp_email_template(otp, purpose)
            
            send_email(
                to_email=email,
                subject=f"GlycoFit - Your {purpose.title()} Code",
                html_content=html_content,
                text_content=f"Your GlycoFit {purpose} code is: {otp}. This code will expire in 10 minutes."
            )
            
            logging.info(f"OTP email sent successfully to {email}")
            return True, "OTP sent successfully"
            
        except Exception as e:
            logging.error(f"Failed to send OTP email to {email}: {str(e)}")
            return False, f"Failed to send OTP: {str(e)}"

    @staticmethod
    def send_welcome_email(email, user_name):
        """Send welcome email to new user"""
        try:
            html_content = create_welcome_email_template(user_name)
            
            send_email(
                to_email=email,
                subject="Welcome to GlycoFit - Let's Start Your Journey",
                html_content=html_content,
                text_content=f"Welcome to GlycoFit, {user_name}! Your account has been successfully created."
            )
            
            logging.info(f"Welcome email sent successfully to {email}")
            return True, "Welcome email sent successfully"
            
        except Exception as e:
            logging.error(f"Failed to send welcome email to {email}: {str(e)}")
            return False, f"Failed to send welcome email: {str(e)}"
