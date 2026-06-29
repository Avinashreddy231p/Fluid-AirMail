import os
import base64
from datetime import datetime, timedelta
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import bcrypt
from jose import jwt

# Security Configurations
SECRET_KEY = "super-secret-mailnet-key-replace-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# For demonstration, we use a static AES key (256-bit). In production, use a KMS.
SERVER_AES_KEY = AESGCM.generate_key(bit_length=256)

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def encrypt_message(plain_text: str) -> dict:
    """Encrypts a string using AES-GCM."""
    aesgcm = AESGCM(SERVER_AES_KEY)
    nonce = os.urandom(12)
    # The encrypt method returns the ciphertext and tag concatenated.
    encrypted_data = aesgcm.encrypt(nonce, plain_text.encode('utf-8'), None)
    
    # We store nonce and the encrypted data separately for the DB
    return {
        "nonce": base64.b64encode(nonce).decode('utf-8'),
        "ciphertext": base64.b64encode(encrypted_data).decode('utf-8')
    }

def decrypt_message(nonce_b64: str, ciphertext_b64: str) -> str:
    """Decrypts AES-GCM encrypted data."""
    aesgcm = AESGCM(SERVER_AES_KEY)
    nonce = base64.b64decode(nonce_b64)
    ciphertext = base64.b64decode(ciphertext_b64)
    
    decrypted_data = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted_data.decode('utf-8')
