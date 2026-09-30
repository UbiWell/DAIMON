import sys
import os
import pytz

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data_processing')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../agents')))

from datetime import datetime, timedelta
from data_processing.data_processing_utils import fetch_documents_between_timestamps

from data_streams.constants import EMA_RESPONSE, time_zone_dict
import json
def parse_ema_data(data):
    # Load the JSON string into a Python dictionary
    # data = json.loads(data_string)

    # Parse the questions JSON string
    questions_data = json.loads(data["questions"])

    # Get the list of questions
    questions_list = questions_data["questions"]

    # Get the results
    results = data["results"]

    # Create a dictionary to map questions to their answers
    question_answer_mapping = {}

    # Initialize counters for completion calculation
    total_questions = 0
    answered_questions = 0

    # Map each question to its corresponding answer
    for i, question in enumerate(questions_list):
        question_text = question["text"]
        question_type = question["type"]
        if question_type in ["greeting", "intro"]:
            continue
        total_questions += 1
        answer_key = f"Question-{i}"
        answer_value = results.get(answer_key, "No answer provided")
        if answer_value != "":
            answered_questions += 1
        question_answer_mapping[question_text] = answer_value

    # Calculate the completion percentage
    completion_percentage = (answered_questions / total_questions) * 100 if total_questions else 0

    return question_answer_mapping, completion_percentage

functions = {
    "EMA1": {
        "name": "get_ema_records",
        "description": "Retrieves EMA records for a specific user within a specified time range. Different EMA surveys can have different questions.",
        "function_call_instructions": "",
        "code_generation_instructions": "",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "uid": {"type": "str", "description": "The unique identifier for the user."},
            "start_time": {"type": "str", "description": "The start timestamp for the time range."},
            "end_time": {"type": "str", "description": "The end timestamp for the time range."}
        },
        "returns": "A list of EMA surveys with metadata about them and answers to the questions.",
        "example": "[{'timestamp': '2025-11-08 01:51:48', 'duration': 16.81, 'identifier': 'EMATask-random_ema', 'completion_rate': 70.0, 'questions_and_answers': {'How positive is your overall mood?': '38', 'How negative is your overall mood?': '26', 'How much energy do you feel you have right now?': '49'}}]"
    }
}


def get_ema_records(uid, start_time, end_time):
    user_timezone = time_zone_dict.get(uid, "est")
    timezone = pytz.timezone("America/New_York") if user_timezone == "est" else pytz.timezone(user_timezone)
    if (not isinstance(start_time, float)):
        if (isinstance(start_time, str)):
            start_time = timezone.localize(datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S")).astimezone(pytz.UTC)
            end_time = timezone.localize(datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S")).astimezone(pytz.UTC)
        start_time = start_time.timestamp()
        end_time = end_time.timestamp()

    ema_records = fetch_documents_between_timestamps(uid, start_time, end_time, EMA_RESPONSE)

    return process_records(uid, ema_records)

def process_records(uid, ema_records):
    records = []
    uid_timezone = time_zone_dict.get(uid, 'est')  # Get UID-specific timezone or default to EST
    timezone = pytz.timezone("America/New_York") if uid_timezone == "est" else pytz.utc
    for r in ema_records:
        d = {}
        timestamp = datetime.fromtimestamp(r['timestamp'], pytz.utc).astimezone(timezone)
        d['timestamp'] = timestamp.strftime('%Y-%m-%d %H:%M:%S')
        data = json.loads(r['ema_repsonse'])
        d['duration'] = data.get('duration', None)
        d['identifier'] = data.get('identifier', None)
        qna_mapping, c_rate = parse_ema_data(data)
        d['completion_rate'] = c_rate
        d['questions_and_answers'] = qna_mapping

        records.append(d)
    return records

if __name__ == "__main__":
    start_datetime = "2025-10-01 0:15:48"
    end_datetime = "2026-03-03 23:11:59"

    ema = (get_ema_records('test004', start_datetime, end_datetime))
    print(ema)
