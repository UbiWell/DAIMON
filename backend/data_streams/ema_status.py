import sys
import os
import pytz

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data_processing')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../agents')))

from datetime import datetime, timedelta
from data_processing.data_processing_utils import fetch_documents_between_timestamps

from data_streams.constants import REAL_TIME_EMA, time_zone_dict, EMA_STATUS_EVENTS


functions = {
    "REMA1": {
        "name": "get_real_time_ema_records",
        "description": "Retrieves real time ema sending logs for a specific user within a specified time range. This includes ema id, ema type, status, acknowledged and acknowledged at timestamp. ema_type is 'ml-triggered', 'random', and 'retrospective'. Status is a list of initiated_sent (started the ema), push_notification_sent (sent a notification), opened (user opened the notification), completed (user completed the ema)",
        "function_call_instructions": "",
        "code_generation_instructions": "",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "uid": {"type": "str", "description": "The unique identifier for the user."},
            "start_time": {"type": "str", "description": "The start timestamp for the time range."},
            "end_time": {"type": "str", "description": "The end timestamp for the time range."}
        },
        "returns": "A list of real-time ema responses for a given time range, where each record contains ema id, ema type, status, acknowledged and acknowledged at timestamp.",
        "example": "[{'created_at': '2025-11-25 17:32:01', 'ema_id': 'ema-random_1764109921', 'ema_type': 'random-ema', 'status': ['initiated_sent', 'push_notification_sent', 'acknowledged', 'sent_ema'], 'acknowledged': True, 'acknowledged_at': '2025-11-25 17:32:13', 'ema_file': 'ema-random'}, {'created_at': '2025-11-29 18:47:02', 'ema_id': 'ema-random_1764460022', 'ema_type': 'random-ema', 'status': ['initiated_sent', 'push_notification_sent'], 'acknowledged': False, 'acknowledged_at': None, 'ema_file': 'ema-random'}, {'created_at': '2025-11-30 15:44:02', 'ema_id': 'ema-random_1764535442', 'ema_type': 'random-ema', 'status': ['initiated_sent', 'push_notification_sent', 'acknowledged', 'sent_ema'], 'acknowledged': True, 'acknowledged_at': '2025-11-30 15:56:02', 'ema_file': 'ema-random'}, {'created_at': '2025-12-01 07:05:02', 'ema_id': 'ema-random_1764590702', 'ema_type': 'random-ema', 'status': ['initiated_sent', 'push_notification_sent', 'acknowledged', 'sent_ema'], 'acknowledged': True, 'acknowledged_at': '2025-12-01 16:28:29', 'ema_file': 'ema-random'}]"
    },
    "REMA2": {
        "name": "get_burst_ema_records",
        "description": "Retrieves burst ema sending logs for a specific user within a specified time range. This includes ema id, ema type, status, and timestamp. This runs every 6 hours and reports the status as 'scheduled', 'pending', 'expired', 'completed'. So first an ema is scheduled but then could be pending and later completed or expired.",
        "function_call_instructions": "",
        "code_generation_instructions": "",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "uid": {"type": "str", "description": "The unique identifier for the user."},
            "start_time": {"type": "str", "description": "The start timestamp for the time range."},
            "end_time": {"type": "str", "description": "The end timestamp for the time range."}
        },
        "returns": "A list of burst ema records for a given time range, where each record contains ema id, ema type, status, and timestamp.",
        "example": "[{'timestamp': '2025-12-03 12:16:04', 'ema_id': 'evening_ema', 'status': 'pending', 'ema_type': 'burst-ema'}, {'timestamp': '2025-12-03 12:16:04', 'ema_id': 'evening_ema', 'status': 'pending', 'ema_type': 'burst-ema'}, {'timestamp': '2025-12-03 12:16:04', 'ema_id': 'evening_ema', 'status': 'pending', 'ema_type': 'burst-ema'}, {'timestamp': '2025-12-03 12:16:04', 'ema_id': 'evening_ema', 'status': 'pending', 'ema_type': 'burst-ema'}, {'timestamp': '2025-12-03 12:16:04', 'ema_id': 'evening_ema', 'status': 'pending', 'ema_type': 'burst-ema'}]"
}
}
def get_real_time_ema_records(uid, start_time, end_time):
    user_timezone = time_zone_dict.get(uid, "est")
    timezone = pytz.timezone("America/New_York") if user_timezone == "est" else pytz.timezone(user_timezone)
    if (not isinstance(start_time, float)):
        if (isinstance(start_time, str)):
            start_time = timezone.localize(datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S")).astimezone(pytz.UTC)
            end_time = timezone.localize(datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S")).astimezone(pytz.UTC)
        start_time = start_time.timestamp()
        end_time = end_time.timestamp()

    ema_records = fetch_documents_between_timestamps(uid, start_time, end_time, REAL_TIME_EMA)

    return process_records(uid, ema_records)

def process_records(uid, ema_records):
    records = []
    uid_timezone = time_zone_dict.get(uid, 'est')  # Get UID-specific timezone or default to EST
    timezone = pytz.timezone("America/New_York") if uid_timezone == "est" else pytz.utc
    for r in ema_records:
        d = {}
        time = datetime.fromtimestamp(r['created_at'], pytz.utc).astimezone(timezone)
        d['created_at'] = time.strftime('%Y-%m-%d %H:%M:%S')
        d['ema_id'] = r['ema_id']
        d['ema_type'] = r['ema_type']
        d['status'] = r['status']
        d['acknowledged'] = r['acknowledged']
        if r['acknowledged_at'] is None:
            d['acknowledged_at'] = None
        else:
            time = datetime.fromtimestamp(r['acknowledged_at'], pytz.utc).astimezone(timezone)
            d['acknowledged_at'] = time.strftime('%Y-%m-%d %H:%M:%S')
        d['ema_file'] = r['ema_file']
        records.append(d)
    return records


def process_records_burst(uid, ema_records):
    records = []
    uid_timezone = time_zone_dict.get(uid, 'est')  # Get UID-specific timezone or default to EST
    timezone = pytz.timezone("America/New_York") if uid_timezone == "est" else pytz.utc
    for r in ema_records:
        d = {}
        time = datetime.fromtimestamp(r['timestamp'], pytz.utc).astimezone(timezone)
        d['timestamp'] = time.strftime('%Y-%m-%d %H:%M:%S')
        d['ema_id'] = r['ema_id']
        d['status'] = r['status']
        d['ema_type'] = "burst-ema"
        records.append(d)
    return records

def get_burst_ema_records(uid, start_time, end_time):
    user_timezone = time_zone_dict.get(uid, "est")
    timezone = pytz.timezone("America/New_York") if user_timezone == "est" else pytz.timezone(user_timezone)
    if (not isinstance(start_time, float)):
        if (isinstance(start_time, str)):
            start_time = timezone.localize(datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S")).astimezone(pytz.UTC)
            end_time = timezone.localize(datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S")).astimezone(pytz.UTC)
        start_time = start_time.timestamp()
        end_time = end_time.timestamp()

    ema_records = fetch_documents_between_timestamps(uid, start_time, end_time, EMA_STATUS_EVENTS)

    return process_records_burst(uid, ema_records)



if __name__ == "__main__":
    start_datetime = "2025-11-25 14:15:48"
    end_datetime = "2025-12-09 11:11:59"

    compliance = (get_real_time_ema_records('test004', start_datetime, end_datetime))
    print(compliance)
