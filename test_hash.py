import bcrypt
import sqlite3

def test_hash():
    # staff_alpha hash from backup DB
    hash_str = b"$2b$12$Z7LzCRJPRQthHZ5qH/8Z3OqpsUb0axGJYFl6Y4iCHxtICfl6r0qfO"
    
    # Let's try some common passwords just to see if we can guess it
    passwords = [b"password", b"password123", b"staff_alpha", b"Welcome@123", b"admin123"]
    
    for p in passwords:
        if bcrypt.checkpw(p, hash_str):
            print(f"Match found! Password is: {p.decode('utf-8')}")
            return
            
    print("None of the common passwords matched.")

test_hash()
