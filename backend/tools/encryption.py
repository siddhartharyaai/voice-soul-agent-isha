"""
Encryption utilities for secure storage of user API keys and sensitive data
"""

import os
import base64
import logging
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)

class EncryptionManager:
    """Handles encryption/decryption of sensitive user data"""
    
    def __init__(self, encryption_key: Optional[str] = None):
        self.encryption_key = encryption_key or os.getenv("ENCRYPTION_KEY")
        self._fernet = None
        
        if self.encryption_key:
            try:
                # Validate and create Fernet instance
                key_bytes = self.encryption_key.encode() if isinstance(self.encryption_key, str) else self.encryption_key
                self._fernet = Fernet(key_bytes)
                logger.info("✅ Encryption manager initialized")
            except Exception as e:
                logger.error(f"❌ Failed to initialize encryption: {e}")
                self._fernet = None
        else:
            logger.warning("⚠️  No encryption key provided - sensitive data will not be encrypted")
    
    @staticmethod
    def generate_key() -> str:
        """Generate a new encryption key"""
        return Fernet.generate_key().decode()
    
    def encrypt(self, data: str) -> Optional[str]:
        """Encrypt a string"""
        if not self._fernet:
            logger.warning("Encryption not available - returning plaintext")
            return data
        
        try:
            encrypted_bytes = self._fernet.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted_bytes).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return None
    
    def decrypt(self, encrypted_data: str) -> Optional[str]:
        """Decrypt a string"""
        if not self._fernet:
            logger.warning("Encryption not available - returning data as-is")
            return encrypted_data
        
        try:
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_bytes = self._fernet.decrypt(encrypted_bytes)
            return decrypted_bytes.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return None
    
    def encrypt_dict(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Encrypt sensitive fields in a dictionary"""
        if not self._fernet:
            return data
        
        encrypted_data = data.copy()
        sensitive_fields = ["api_key", "token", "secret", "password", "access_token", "refresh_token"]
        
        for field in sensitive_fields:
            if field in encrypted_data and encrypted_data[field]:
                encrypted_value = self.encrypt(str(encrypted_data[field]))
                if encrypted_value:
                    encrypted_data[field] = encrypted_value
        
        return encrypted_data
    
    def decrypt_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Decrypt sensitive fields in a dictionary"""
        if not self._fernet:
            return data
        
        decrypted_data = data.copy()
        sensitive_fields = ["api_key", "token", "secret", "password", "access_token", "refresh_token"]
        
        for field in sensitive_fields:
            if field in decrypted_data and decrypted_data[field]:
                decrypted_value = self.decrypt(str(decrypted_data[field]))
                if decrypted_value:
                    decrypted_data[field] = decrypted_value
        
        return decrypted_data
    
    def is_available(self) -> bool:
        """Check if encryption is available"""
        return self._fernet is not None

# Global instance
encryption_manager = EncryptionManager()