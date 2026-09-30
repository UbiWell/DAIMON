"""
Function to add dummy EMA response data to the database
"""

import sys
import os
import json

# Add paths for imports
# Get the root directory (parent of temp_scripts)
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(root_dir)
sys.path.append(os.path.join(root_dir, 'data_processing'))
sys.path.append(os.path.join(root_dir, 'data_streams'))

from data_processing.db_config import DbConfig
from data_streams.constants import EMA_RESPONSE


def add_dummy_ema_response(uid, timestamp):
    """
    Add dummy EMA response data to the ema_response database collection.
    
    Args:
        uid (str): User ID (e.g., 'test004')
        timestamp (float): Unix timestamp for the EMA response
    
    Returns:
        dict: The inserted document with _id, or None if insertion failed
    """
    # Get database connection
    db = DbConfig().getDb()
    collection = db[EMA_RESPONSE]
    
    # Dummy EMA response data structure
    ema_response_json = {
        "results": {
            "Question-21": "20",
            "Question-25-2": "In-person",
            "Question-36": "No",
            "Question-6": "20",
            "Question-11": "0",
            "Question-7": "54",
            "Question-1": "69",
            "Question-25-1": "Close friend(s)",
            "Question-26-0": "no",
            "Question-4": "42",
            "Question-14": "68",
            "Question-21-2": "I am not doing anything",
            "Question-25-0": "Other",
            "Question-21-0": "Other",
            "Question-3": "48",
            "Question-2": "No",
            "Question-16": "49",
            "Question-20": "79",
            "Question-22": "58",
            "Question-25": "56",
            "Question-15": "50",
            "Question-30": "69",
            "Question-8": "21",
            "Question-34": "84",
            "Question-18": "58",
            "Question-23": "70",
            "Question-0": "",
            "Question-27": "no",
            "Question-35": "72",
            "Question-17": "38",
            "IntroStep": "",
            "Question-12": "0",
            "Question-32": "0",
            "Question-10": "0",
            "Question-26": "Family",
            "Question-5": "63",
            "Question-28": "83",
            "Question-29": "89",
            "Question-33": "80",
            "Question-19": "41",
            "Question-9": "0",
            "Question-21-1": "No",
            "Question-24": "68",
            "Question-31": "88",
            "Question-13": "0"
        },
        "completed_time": "20251210_073256",
        "status": "completed",
        "scheduled_time": "20251210_072417",
        "questions": (
            '{"endTime":"08:30:12","text":"Morning Survey","validHours":1,"startTime":"06:30:12",'
            '"schedule":"fixed","title":"Morning Survey","timingsDayMap":{"Monday":{"endTime":"07:30:03",'
            '"startTime":"06:30:03","schedule":"random"},"Thursday":{"endTime":"07:30:03","startTime":"06:30:03",'
            '"schedule":"random"},"Friday":{"endTime":"07:30:03","startTime":"06:30:03","schedule":"random"},'
            '"Saturday":{"endTime":"09:00:00","startTime":"08:00:05","schedule":"random"},'
            '"Sunday":{"endTime":"09:00:00","startTime":"08:00:05","schedule":"random"},'
            '"Tuesday":{"endTime":"07:30:03","startTime":"06:30:03","schedule":"random"},'
            '"Wednesday":{"endTime":"07:30:03","startTime":"06:30:03","schedule":"random"}},'
            '"questions":[{"type":"greeting","text":"Lets begin your survey! All of your answers are de-identified.",'
            '"em":"will NOT"},{"max":100,"min":0,"type":"slider","scaleExplanation":"very poor:very good",'
            '"text":"How was your sleep quality last night?"},{"onSelect":{"condition":"==Yes","questions":'
            '[{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:extremely vivid",'
            '"text":"How vivid were they?"}]},"answers":["Yes","No"],"answerValues":[1,0],"type":"radio",'
            '"text":"Did you have any dreams?"},{"max":100,"min":0,"type":"slider",'
            '"scaleExplanation":"not well rested:very well rested","text":"How rested did you feel shortly after waking up?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"very bad:very good",'
            '"text":"How do you expect the rest of the day to go?"},{"max":100,"min":0,"type":"slider",'
            '"scaleExplanation":"not at all positive:very positive","text":"How positive is your overall mood?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all negative:very negative",'
            '"text":"How negative is your overall mood?"},{"max":100,"min":0,"type":"slider",'
            '"scaleExplanation":"low:high","text":"How much energy do you feel you have right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How sad do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How angry do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How lonely do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How bored do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How anxious do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How depressed do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How happy do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How excited do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How curious do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How optimistic do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very",'
            '"text":"How compassionate towards others do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very",'
            '"text":"How compassionate towards yourself do you feel right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very","text":"How grateful do you feel right now?"},'
            '{"max":100,"min":0,"onSelect":{"condition":">0","questions":[{"type":"multi_choice",'
            '"text":"What are you feeling stressed about?","answers":["Relationships with peers or friends","Academics",'
            '"Family","Money\\\\/Finances","State of the world","Other"]},{"answers":["Yes","No"],"answerValues":[1,0],'
            '"type":"radio","text":"Is it within your control to change the situation?"},{"type":"multi_choice",'
            '"text":"How are you coping?","answers":["Realizing I just have to live with things the way they are",'
            '"Doing or planning something to make things better","Talking to someone about it",'
            '"Trying to think of the situation another way so it doesn\'t seem so bad",'
            '"Crying or showing my emotion another way","I keep thinking about how I am feeling or how bad the situation is",'
            '"Trying to not think about it or doing something to distract myself",'
            '"Trying to avoid being on SM\\\\/around the people or situation that is bothering me","Something else",'
            '"I am not doing anything"]}]},"type":"slider","scaleExplanation":"Not at all:Very",'
            '"text":"How stressed do you feel right now?"},{"max":100,"min":0,"type":"slider",'
            '"scaleExplanation":"not at all:very much","text":"How much do you feel you can enjoy good things right now?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"very bad:very good",'
            '"text":"How do you feel about yourself right now?"},{"max":100,"min":0,"type":"slider",'
            '"scaleExplanation":"Not at all typical:Very typical","text":"How typical was your phone use since the survey last evening?"},'
            '{"max":100,"min":0,"onSelect":{"condition":">0","questions":[{"allowText":true,'
            '"answers":["To have a good time","To relieve negative feelings (e.g., loneliness, boredom)","Other"],'
            '"type":"multi_choice","text":"Why?"},{"type":"multi_choice","text":"With whom:",'
            '"answers":["Family","Trusted adult(s)","Close friend(s)","Romantic interest(s)","Peer(s)","Stranger(s)",'
            '"It doesn\'t matter"]},{"type":"multi_choice","text":"Do you want to socialize online or in-person?",'
            '"answers":["Online","In-person"]}]},"type":"slider","scaleExplanation":"not at all:very much",'
            '"text":"How much do you want to socialize right now?"},{"onSelect":{"condition":"!=No one","questions":'
            '[{"answers":["yes","no"],"answerValues":[1,0],"type":"radio",'
            '"text":"Right before this survey, were you actively socializing with those people?"}]},'
            '"answers":["Family","Trusted adult(s)","Close friend(s)","Romantic interest(s)","Peer(s)","Stranger(s)","No one"],'
            '"type":"multi_choice","text":"Right now, who are you around?"},{"onSelect":{"condition":"==yes","questions":'
            '[{"type":"multi_choice","text":"With whom:","answers":["Family","Trusted adult(s)","Close friend(s)",'
            '"Romantic interest(s)","Peer(s)","Stranger(s)","No one"]}]},"answers":["yes","no"],"answerValues":[1,0],'
            '"type":"radio","text":"Right before this survey, were you actively socializing online?"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very",'
            '"text":"How close, connected, or supported do you feel to\\\\/by: Parent"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very",'
            '"text":"How close, connected, or supported do you feel to\\\\/by: Siblings"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very",'
            '"text":"How close, connected, or supported do you feel to\\\\/by: Trusted adult(s)"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very",'
            '"text":"How close, connected, or supported do you feel to\\\\/by: Close friend(s)"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very",'
            '"text":"How close, connected, or supported do you feel to\\\\/by: Romantic interest(s)"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very",'
            '"text":"How close, connected, or supported do you feel to\\\\/by: Peer(s)"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very",'
            '"text":"How close, connected, or supported do you feel to\\\\/by: Broader community"},'
            '{"max":100,"min":0,"type":"slider","scaleExplanation":"not at all:very",'
            '"text":"How much effort are you willing to put into socializing the rest of the day?"},'
            '{"onSelect":{"condition":"==Yes","questions":[{"max":100,"min":0,"type":"slider",'
            '"scaleExplanation":"not at all:very","text":"How much are you looking forward to this social interaction(s)?"}]},'
            '"answers":["Yes","No"],"answerValues":[1,0],"type":"radio",'
            '"text":"In the next few hours, do you have social interactions planned?"}],"version":1}'
        ),
        "identifier": "EMATask-morning_ema",
        "duration": 113.36543297767639
    }
    
    # Create document to insert
    document = {
        "uid": uid,
        "timestamp": timestamp,
        "ema_repsonse": json.dumps(ema_response_json)  # Note: typo "repsonse" matches database schema
    }
    
    try:
        # Insert document into collection
        result = collection.insert_one(document)
        print(f"Successfully inserted dummy EMA response for {uid} with timestamp {timestamp}")
        print(f"Inserted document ID: {result.inserted_id}")
        
        # Return the inserted document
        inserted_doc = collection.find_one({"_id": result.inserted_id})
        return inserted_doc
    except Exception as e:
        print(f"Error inserting dummy EMA response: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    # Example usage
    import time
    
    # Example: Add dummy EMA response for test004 with current timestamp
    uid = "test004"
    est_date = "2025-12-06 07:30:00"
    dt_object = time.strptime(est_date, '%Y-%m-%d %H:%M:%S')
    timestamp = time.mktime(dt_object)
    print(timestamp)
    
    result = add_dummy_ema_response(uid, timestamp)
    if result:
        print(f"\nInserted document:")
        # print(json.dumps(result, indent=2, default=str))
