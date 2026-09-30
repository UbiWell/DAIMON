import sys
import os
import pytz

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data_processing')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../agents')))

from datetime import datetime, timedelta
from data_processing.data_processing_utils import fetch_documents_between_timestamps

from data_streams.constants import DAILY_SUMMARY, time_zone_dict


functions = {
    "COMP1": {
        "name": "get_compliance_records",
        "description": "Retrieves daily compliance records for a specific user within a specified time range. This includes duration of incoming phone data, Garmin Worn and Garmin On durations in hours. Also includes EMA surveys answered and EMA surveys scheduled",
        "function_call_instructions": "",
        "code_generation_instructions": "",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "uid": {"type": "str", "description": "The unique identifier for the user."},
            "start_time": {"type": "str", "description": "The start timestamp for the time range."},
            "end_time": {"type": "str", "description": "The end timestamp for the time range."}
        },
        "returns": "A list of daily compliance records for a given date, where each record contains incoming phone data duration, Garmin (smartwatch) worn, and Garmin (smartwatch) on but not worn. EMA surveys answered and EMA surveys scheduled. The duration are in hours.",
        "example": "[{'date': '2025-08-24 00:00:00', 'phone_data_duration': 23.872500000000002, 'garmin_worn_duration': 2.25, 'garmin_on_duration': 4.847222222222222, 'ema_scheduled': 1, 'ema_completed': 0}, {'date': '2025-08-25 00:00:00', 'phone_data_duration': 23.426111111111116, 'garmin_worn_duration': 10.402777777777779, 'garmin_on_duration': 24.01388888888889, 'ema_scheduled': 1, 'ema_completed': 0, 'total_app_events': 150}]"
    }
}


def get_compliance_records(uid, start_time, end_time):
    user_timezone = time_zone_dict.get(uid, "est")
    timezone = pytz.timezone("America/New_York") if user_timezone == "est" else pytz.timezone(user_timezone)
    if (not isinstance(start_time, float)):
        if (isinstance(start_time, str)):
            start_time = timezone.localize(datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S")).astimezone(pytz.UTC)
            end_time = timezone.localize(datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S")).astimezone(pytz.UTC)
        start_time = start_time.timestamp()
        end_time = end_time.timestamp()

    compliance_records = fetch_documents_between_timestamps(uid, start_time, end_time, DAILY_SUMMARY)

    return process_records(uid, compliance_records)

def process_records(uid, compliance_records):
    records = []
    uid_timezone = time_zone_dict.get(uid, 'est')  # Get UID-specific timezone or default to EST
    timezone = pytz.timezone("America/New_York") if uid_timezone == "est" else pytz.utc
    for r in compliance_records:
        d = {}
        time = datetime.fromtimestamp(r['date'], pytz.utc).astimezone(timezone)
        d['date'] = time.strftime('%Y-%m-%d %H:%M:%S')
        d['phone_data_duration'] = r['location_duration']
        d['garmin_worn_duration'] = r['empatica_duration']
        d['garmin_on_duration'] = r['stress_duration']
        d['ema_scheduled'] = len(r['scheduled_emas'])
        d['ema_completed'] = len(r['completed_emas'])
        d['total_app_events'] = r.get('total_app_events', 0)

        records.append(d)
    return records

if __name__ == "__main__":
    start_datetime = "2025-08-19 14:15:48"
    end_datetime = "2025-08-25 11:11:59"

    compliance = (get_compliance_records('test004', start_datetime, end_datetime))
    print(compliance)
