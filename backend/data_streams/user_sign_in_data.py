import sys
import os
import pytz
import random
import string
import hashlib

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data_processing')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../agents')))

from datetime import datetime, timedelta
from data_processing.data_processing_utils import fetch_all_documents
from data_processing.db_config import DbConfig
from pymongo.errors import DuplicateKeyError

from data_streams.constants import USER_DATA, time_zone_dict

def generate_token(study_id, length):
    pwd = []
    length = length - 2
    chars = string.ascii_uppercase + string.digits
    random.seed = (os.urandom(1024))
    for i in range(length):
        pwd.append(random.choice(chars))

    token = ''.join(pwd)
    return str(study_id) + str(token)

def insert_token(db, study_id, uid):
    user_obj = {}

    user_obj['uid'] = uid
    user_obj['uid_code'] = generate_token(study_id, 6)

    print(user_obj)

    try:
        db['user_code_mappings'].insert_one(user_obj)
    except DuplicateKeyError:
        print("insert code failed -- " + str(user_obj) + " -- creating new")
        # insert_token(study_id, uid)
    pass
def generate_password(length):
    pwd = []

    pwd.append(random.choice(string.ascii_lowercase))
    pwd.append(random.choice(string.ascii_uppercase))
    pwd.append(str(random.randint(0, 9)))
    pwd.append(random.choice('@#$%'))

    length = length-6

    chars = string.ascii_letters + string.digits + '@#$%'
    # random.seed(24)

    for i in range(length):
        pwd.append(random.choice(chars))

    random.shuffle(pwd)
    password = ''.join(pwd)
    password = random.choice(string.ascii_letters) + password
    password = password + random.choice(string.ascii_letters)
    return password
def ensure_uid_in_code_mappings(uid):
    """
    Check if uid already exists in user_code_mappings collection.
    If not, add it with a generated token.
    
    Args:
        db: Database connection
        study_id: Study identifier
        uid: User identifier
        
    Returns:
        dict: User code mapping object if found or created, None if creation failed
    """
    # Check if uid already exists in user_code_mappings
    db = DbConfig().getDb()
    study_id = "A1"
    existing_mapping = db['user_code_mappings'].find_one({'uid': uid})
    
    if existing_mapping:
        print(f"UID {uid} already exists in user_code_mappings")
        print(existing_mapping)
        return existing_mapping
    else:
        print(f"UID {uid} not found in user_code_mappings, adding it")
        # Create user object with token
        user_obj = {
            'uid': uid,
            'uid_code': generate_token(study_id, 6)
        }
        
        try:
            db['user_code_mappings'].insert_one(user_obj)
            create_and_insert_user(uid)
            print(f"Successfully added UID {uid} to user_code_mappings")
            return user_obj
        except DuplicateKeyError:
            print(f"Failed to insert UID {uid} - duplicate key error")
            # Try to fetch again in case it was inserted by another process
            existing_mapping = db['user_code_mappings'].find_one({'uid': uid})
            if existing_mapping:
                return existing_mapping
            return None
        except Exception as e:
            print(f"Error inserting UID {uid} to user_code_mappings: {e}")
            return None




functions = {
    "USER1": {
        "name": "get_unused_sign_in_codes",
        "description": "Retrieves the unused sign-in code for each user that has not logged in yet.",
        "function_call_instructions": "",
        "code_generation_instructions": "",
        "usecase": ["code_generation", "function_calling"],
        "params": {},
        "returns": "A dictionary where each key is a user ID (uid) and each value is the unused access code.",
        "example": "{'user123': 'ABC123', 'user456': 'XYZ789'}"
    },
    "USER2": {
        "name": "get_user_data_by_uid",
        "description": "Fetches the complete user record for a given user ID (uid).",
        "function_call_instructions": "",
        "code_generation_instructions": "",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            'uid': {"type": "str", "description": "The unique identifier for the user."}
        },
        "returns": "A dictionary containing all available user data for the given uid, or None if no match is found.",
        "example": "{'uid': 'test004', 'ios_last_ping': '2025-09-11 14:46:06', 'ios_login_time': '2025-03-03 17:37:21', 'access_codes': ['A147E2']}"
    },
    "USER3": {
        "name": "ensure_uid_in_code_mappings",
        "description": "Ensures that a given user ID (uid) exists in the user_code_mappings collection. If not, it adds the uid with a generated access code.",
        "function_call_instructions": "",
        "code_generation_instructions": "",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            'uid': {"type": "str", "description": "The unique identifier for the user."}
        },
        "returns": "A dictionary containing the uid and its corresponding access code if found or created, or None if creation failed.",
        "example": "{'uid': 'test004', 'uid_code': 'A1XYZ123'}"
    }
}


def convert_timestamp(ts, tz=pytz.utc):
    """
    Convert a Unix timestamp (seconds or milliseconds) to datetime in given timezone.

    Parameters:
    - ts (int or float): Unix timestamp (seconds or milliseconds).
    - tz (pytz.timezone): Target timezone (default: UTC).

    Returns:
    - datetime: Converted datetime object in target timezone.
    """
    # If timestamp looks like milliseconds (>= 10^11), divide by 1000
    if ts > 1e11:
        ts = ts / 1000

    return datetime.fromtimestamp(ts, pytz.utc).astimezone(tz)

def get_user_data():
    user_data = fetch_all_documents(USER_DATA)
    return process_records(user_data)


def create_and_insert_user(uid, study_id="A1"):
    """
    Creates and inserts a user into the database with generated credentials.

    Args:
        uid: User identifier (e.g., 'test004')
        study_id: Study identifier (default: "A1")

    Returns:
        dict: Created user object, or None if insert failed
    """
    # Get database connection

    db = DbConfig().getDb()
    base_email = 'random-study'
    email = f"{base_email}+{uid}@gmail.com"

    study_password = generate_password(10)
    garmin_password = generate_password(13)


    # Generate encryption key
    complete = uid + study_password
    print(complete)
    hash_obj = hashlib.md5(str.encode(complete))
    hash_str = hash_obj.hexdigest()
    encryption_key = hash_str[:16]

    user_obj = {
        'uid': uid,
        'email': email,
        'study_pass': study_password,
        'garmin_pass': garmin_password,
        'file_encryption_key': encryption_key
    }

    try:
        db['users'].insert_one(user_obj)
        insert_token(db, study_id, uid)
        return user_obj
    except DuplicateKeyError:
        print(f"insert failed -- {user_obj}")
        return None

def process_records(user_data):
    records = []

    for r in user_data:
        uid  = r['uid']
        uid_timezone = time_zone_dict.get(uid, 'est')  # Get UID-specific timezone or default to EST
        timezone = pytz.timezone("America/New_York") if uid_timezone == "est" else pytz.utc
        d = {}
        # print(r)
        d['uid'] = uid
        if 'ios_last_ping' in r and r['ios_last_ping'] != 0:
            time = convert_timestamp(r["ios_last_ping"], timezone)
            d['ios_last_ping'] = time.strftime('%Y-%m-%d %H:%M:%S')
        else:
            d['ios_last_ping'] = "no pings yet"
        if "ios_login_time"in r and r['ios_login_time']  != []:
            time = convert_timestamp(r['ios_login_time'][-1], timezone)
            d['ios_login_time'] = time.strftime('%Y-%m-%d %H:%M:%S')
        else:
            d['ios_login_time'] = "No logins yet"
        d['access_codes'] = r.get('access_codes', [])
        records.append(d)
    return records

def get_unused_sign_in_codes():
    user_data = get_user_data()
    unused_codes = {}
    for record in user_data:
        uid = record.get('uid')
        access_codes = record.get('access_codes', [])
        if access_codes:
            if record['ios_login_time'] == "No logins yet":
                unused_codes[uid] = access_codes[0]
    return unused_codes

def get_user_data_by_uid(uid):
    user_data = get_user_data()
    for record in user_data:
        if record.get('uid') == uid:
            return record
    return None





if __name__ == "__main__":
    # start_datetime = "2025-08-19 14:15:48"
    # end_datetime = "2025-08-25 11:11:59"
    #
    # rec = get_unused_sign_in_codes()
    # print(rec)
    ensure_uid_in_code_mappings('test004')

    # print(rec)

