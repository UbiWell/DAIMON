import os
import json
from pymongo import MongoClient
from datetime import datetime, timezone
from flask import jsonify
from data_processing import db_config
# Connect to MongoDB for user data

active_users = ["test004"]
def connect_db():
    # global client, db
    try:
        db = db_config.DbConfig().getDb()
        print('Connected to MongoDB')
        return db
    except Exception as error:
        print(f'MongoDB connection error: {error}')

def get_users_list():
    return active_users
    db = connect_db()
    users_collection = db['users']
    users = list(users_collection.find({}))
    uids = []
    for u in users:
        uids.append(u['uid'])
    return uids

def fetch_user_data(date_str):
    try:
        db = connect_db()

        users_collection = db['users']
        daily_summaries_collection = db['daily_summaries']
        
        # Get all users
        users = list(users_collection.find({}))
        print(f"Found {len(users)} users")
        
        # Convert date string to timestamp (matching your Python logic)
        date_obj = datetime.strptime(date_str, '%m/%d/%y')
        # Set to start of day (00:00:00)
        date_obj = date_obj.replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_day = int(date_obj.timestamp())
        
        # Set to end of day (23:59:59)
        date_obj = date_obj.replace(hour=23, minute=59, second=59, microsecond=999000)
        end_of_day = int(date_obj.timestamp())
        
        transformed_users = []
        
        for user in users:
            uid = user['uid']
            if uid not in active_users:
                continue
            print(f"Processing user: {uid}")
            
            # Try to find daily summary with original timestamp
            daily_summary = daily_summaries_collection.find_one({
                'uid': uid,
                'date': {
                    '$gte': start_of_day,
                    '$lte': end_of_day
                }
            })
            
            # If not found, try with UTC adjustment (subtract 4 hours = 14400 seconds)
            if not daily_summary:
                adjusted_start_timestamp = start_of_day - 14400
                adjusted_end_timestamp = end_of_day - 14400
                daily_summary = daily_summaries_collection.find_one({
                    'uid': uid,
                    'date': {
                        '$gte': adjusted_start_timestamp,
                        '$lte': adjusted_end_timestamp
                    }
                })
            
            if daily_summary:
                print(f"Found daily summary for {uid}")
                
                # Format phone duration (location_duration)
                phone_duration = (f"{daily_summary.get('location_duration', 0):.2f}" 
                                if daily_summary.get('location_duration') is not None else 'n.a.')
                
                # Format garmin worn (empatica_duration)
                garmin_worn = (f"{daily_summary.get('empatica_duration', 0):.2f}" 
                                if daily_summary.get('empatica_duration') is not None else 'n.a.')
                
                # Format stress duration
                garmin_on = (f"{daily_summary.get('stress_duration', 0):.2f}" 
                            if daily_summary.get('stress_duration') is not None else 'n.a.')
                
                # Format distance
                distance = (f"{daily_summary.get('distance', 0):.2f}" 
                            if daily_summary.get('distance') is not None else 'n.a.')
                
                # Get app events
                app_events = daily_summary.get('total_app_events', 0)
                
                # Handle depression scores
                depression_scores = 'n.a.'
                if daily_summary.get('depression_scores'):
                    if isinstance(daily_summary['depression_scores'], str):
                        depression_scores = daily_summary['depression_scores']
                    else:
                        depression_scores = json.dumps(daily_summary['depression_scores'])
                
                # EMA info for status
                ema_info = '0/0'
                if (daily_summary.get('scheduled_emas') and daily_summary.get('completed_emas')):
                    scheduled_count = len(daily_summary['scheduled_emas'])
                    completed_count = len(daily_summary['completed_emas'])
                    ema_info = f"{completed_count}/{scheduled_count}"
                
                # Determine color based on metrics (using Tailwind classes)
                color = 'text-gray-500'
                if daily_summary.get('location_duration') is not None:
                    location_duration = daily_summary['location_duration']
                    if location_duration < 3:
                        color = 'text-green-500'
                    elif location_duration > 6:
                        color = 'text-red-500'
                    else:
                        color = 'text-yellow-500'
                
                transformed_users.append({
                    'uid': uid,
                    'phone_duration': phone_duration,
                    'garmin_worn': garmin_worn,
                    'garmin_on': garmin_on,
                    'distance': distance,
                    'app_events': app_events,
                    'depression_scores': depression_scores,
                    'color': color,
                    'status': f"EMAs: {ema_info}, Distance: {distance}m\nRed: Phone Duration > 6hrs\nYellow: 3hrs < Phone Duration < 6hrs\nGreen: Phone Duration < 3hrs"
                })
            else:
                print(f"No daily summary found for {uid} on {date_str}")
        
        print(f"Returning {len(transformed_users)} transformed users")
        return jsonify(transformed_users)

    except Exception as error:
        print(f'Error fetching users: {error}')
        return jsonify({'error': 'Failed to fetch users', 'details': str(error)}), 500

