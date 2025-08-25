import cloudinary
import cloudinary.uploader
import cloudinary.api
from flask import current_app
import os
import logging
from datetime import datetime

def init_cloudinary():
    """Initialize Cloudinary with configuration"""
    try:
        cloudinary.config(
            cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
            api_key=os.getenv('CLOUDINARY_API_KEY'),
            api_secret=os.getenv('CLOUDINARY_API_SECRET'),
            secure=True
        )
        
        # Test the connection
        cloudinary.api.ping()
        logging.info("Cloudinary initialized successfully")
        
    except Exception as e:
        logging.error(f"Failed to initialize Cloudinary: {str(e)}")
        raise e

class CloudinaryService:
    @staticmethod
    def upload_image(file_path, folder=None, public_id=None, transformation=None):
        """Upload image to Cloudinary"""
        try:
            upload_options = {
                'secure': True,
                'resource_type': 'image'
            }
            
            if folder:
                upload_options['folder'] = folder
            
            if public_id:
                upload_options['public_id'] = public_id
            
            if transformation:
                upload_options['transformation'] = transformation
            
            result = cloudinary.uploader.upload(file_path, **upload_options)
            
            logging.info(f"Image uploaded successfully to Cloudinary: {result.get('public_id')}")
            
            return {
                'success': True,
                'public_id': result.get('public_id'),
                'url': result.get('secure_url'),
                'width': result.get('width'),
                'height': result.get('height'),
                'format': result.get('format'),
                'bytes': result.get('bytes')
            }
            
        except Exception as e:
            logging.error(f"Failed to upload image to Cloudinary: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def upload_avatar(file_path, user_id, old_public_id=None):
        """Upload user avatar with specific settings"""
        try:
            # Delete old avatar if exists
            if old_public_id:
                CloudinaryService.delete_image(old_public_id)
            
            # Upload new avatar
            result = CloudinaryService.upload_image(
                file_path=file_path,
                folder='avatars',
                public_id=f"avatar_{user_id}_{int(datetime.now().timestamp())}",
                transformation=[
                    {'width': 150, 'height': 150, 'crop': 'fill', 'gravity': 'face'},
                    {'quality': 'auto', 'fetch_format': 'auto'}
                ]
            )
            
            if result['success']:
                logging.info(f"Avatar uploaded successfully for user {user_id}")
                return {
                    'public_id': result['public_id'],
                    'url': result['url']
                }
            else:
                raise Exception(result['error'])
                
        except Exception as e:
            logging.error(f"Failed to upload avatar for user {user_id}: {str(e)}")
            raise e
    
    @staticmethod
    def delete_image(public_id):
        """Delete image from Cloudinary"""
        try:
            result = cloudinary.uploader.destroy(public_id)
            
            if result.get('result') == 'ok':
                logging.info(f"Image deleted successfully from Cloudinary: {public_id}")
                return True
            else:
                logging.warning(f"Failed to delete image from Cloudinary: {public_id}")
                return False
                
        except Exception as e:
            logging.error(f"Error deleting image from Cloudinary: {str(e)}")
            return False
    
    @staticmethod
    def get_image_info(public_id):
        """Get image information from Cloudinary"""
        try:
            result = cloudinary.api.resource(public_id)
            
            return {
                'success': True,
                'public_id': result.get('public_id'),
                'url': result.get('secure_url'),
                'width': result.get('width'),
                'height': result.get('height'),
                'format': result.get('format'),
                'bytes': result.get('bytes'),
                'created_at': result.get('created_at')
            }
            
        except Exception as e:
            logging.error(f"Failed to get image info from Cloudinary: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def generate_upload_url(public_id, folder=None):
        """Generate signed upload URL for direct client uploads"""
        try:
            upload_options = {
                'public_id': public_id,
                'timestamp': int(datetime.now().timestamp())
            }
            
            if folder:
                upload_options['folder'] = folder
            
            # Generate signature
            signature = cloudinary.utils.api_sign_request(
                upload_options,
                os.getenv('CLOUDINARY_API_SECRET')
            )
            
            upload_options['signature'] = signature
            upload_options['api_key'] = os.getenv('CLOUDINARY_API_KEY')
            
            return {
                'success': True,
                'upload_url': f"https://api.cloudinary.com/v1_1/{os.getenv('CLOUDINARY_CLOUD_NAME')}/image/upload",
                'upload_options': upload_options
            }
            
        except Exception as e:
            logging.error(f"Failed to generate upload URL: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }