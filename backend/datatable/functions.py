import sys
import os
import time

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
import sensemaking_process
from agents.dashboard_mode_deciding_agent import ModeAgent
from dashboards_backend.datatable.users import get_users_list
import random
import shutil
import json
import csv
from data_streams.past_issues import get_past_issue_by_id
from dashboards_backend.issue_tracker.issue_tracker_database import get_issue, update_issue

def flag_issues(criteria: str, date_str, view_id):
    d = {
        "test004": {
            "color": "yellow",
            "reason": "Phone duration was 16.12 hours on 2025-09-20, which is below the 20-hour threshold. The previous day had a significant increase to 23.75 hours, indicating potential inconsistency in phone usage."
        }
    }
    # return {"criteria": criteria, "results": d}
    initial_prompt = f"""You need to detect if there is any issues with incoming data on {date_str}. 
    You have the following users: {', '.join(get_users_list())}. 
    
    An issue is defined as
     
     CRITERIA
     {criteria}. 
    
    
    
    Only use issue definition provided above to detect issues.
    include this definition in all the requests made to agents.
    Use this criteria to detect if there is any issue with incoming data for each user above.
    if there is any issue, summarize the issue and provide possible reasons for the issue.
    use "compliance database" to get compliance data and provide reasoning by looking at last 7 days of compliance data in case there is an issue
    Use compliance data to provide reasoning for the issue. 
    Only provide reasoning for the defined criteria of issue.
    
    For example if criteria is something about low garmin wear yoy can  if you see garmin on is high but garmin worn is low, you can say that user might not be wearing the garmin watch.
    
    Assign three colors to issue
    - green: No issues detected
    - yellow: Not a issue but close to being an issue
    - red: Major issues detected, data quality is poor"""

    format_instructions = 'Provide your answer in the following format: {"user_id": {"color": "issue color", "reason": "reason for issue, e.g., example of issue"}}'
    format_instructions += "example: {\"user_123\": {\"color\": \"red\", \"reason\": \"No incoming phone data for the last 3 days. Garmin worn duration is very low compared to garmin on duration, user might not be wearing the garmin watch.\"}, \"user_456\": {\"color\": \"green\", \"reason\": \"No issues detected.\"}}"

    initial_prompt += format_instructions

    presentation_instructions_ = '''
           Give the final answer in the following format:
       '''
    presentation_instructions_ += format_instructions

    print(initial_prompt)

    sensemaker = sensemaking_process.SenseMaker(
        initial_prompt,
        presentation_instructions_)
    sensemaker.make_sense()

    result = {
        "criteria": criteria,
        "results": sensemaker.answer,
    }
    return result


def troubleshooting(issue_id):
    print("here")
    issue = get_past_issue_by_id(issue_id)
    if issue is None:
        return {"results": "Could not troubleshoot the issue"}
    
    # Check if troubleshooting_steps already exists in the issue
    existing_troubleshooting = issue.get('troubleshooting_steps', '')
    
    # Handle different data types that might be in the CSV field
    if existing_troubleshooting is not None:
        # Convert to string if it's not already
        if not isinstance(existing_troubleshooting, str):
            existing_troubleshooting = str(existing_troubleshooting)
        
        # Check if it's a valid troubleshooting steps (not empty, not NaN, not N/A)
        if (existing_troubleshooting.strip() != '' and 
            existing_troubleshooting.strip().lower() != 'nan' and 
            existing_troubleshooting.strip() != 'N/A' and
            existing_troubleshooting.strip() != 'None'):
            print(f"Using existing troubleshooting steps for issue {issue_id}")
            return {
                "issue_id": issue_id,
                "troubleshooting_plan": existing_troubleshooting,
                "cached": True
            }
    
    # Gather all information about the issue
    issue_info = f"""
    Summary: {issue.get('summary', 'N/A')}
    User ID: {issue.get('uid', 'N/A')}
    ISSUE ID: {issue.get('issue_id', 'N/A')}
    Created At: {issue.get('created_at', 'N/A')}
    """
    
    # Format notes information
    notes_info = ""
    if issue.get('notes') and isinstance(issue['notes'], dict):
        notes_info = "\nRA Notes:\n"
        for note_key, note_data in issue['notes'].items():
            if isinstance(note_data, dict):
                username = note_data.get('username', 'Unknown')
                content = note_data.get('content', '')
                timestamp = note_data.get('timestamp', '')
                notes_info += f"- {username}: {content} (Timestamp: {timestamp})\n"

    
    initial_prompt = f"""You need to troubleshoot the following issue: {issue.get('summary', 'N/A')}.

    Complete Issue Information:
    {issue_info}
    Notes from RAs:
    {notes_info}
    existing troubleshooting steps:
    {issue.get('troubleshooting_steps', 'N/A')}
    
    Your task is to provide comprehensive troubleshooting guidance for this issue. Consider the following:
    
    2. Review any existing troubleshooting steps and notes from RAs
    3. Gather information from any relevant past issues
    4. Provide step-by-step troubleshooting recommendations
    5. Suggest potential root causes based on the information available
    6. Recommend next steps for resolution
    
    Use the following databases to gather additional context:
    - Use "compliance database" to check user's recent compliance data
    - Use "past issues database" to find similar issues and their resolutions
    - Use "study docs database" to reference study procedures and protocols
    - If issue talks about specific data streams, use relevant databases like "location database", "activity database" etc.
    - Look at last 2 days of data starting issue creation date to provide context and confirm if issue is present
    
    Again issue was Created At: {issue.get('created_at', 'N/A')}
    User ID: {issue.get('uid', 'N/A')}
    
    Start with your best guess on why the issue is happening based on the information available.
    Then provide a structured troubleshooting plan.
    Highlight the information used to come up with troubleshooting plan.
    """

    presentation_instructions = '''Present a properly formatted and concise and effective troubleshooting plan. Dont make troubleshooting steps wordy and too long. Be on point.'''
    
    print(f"Troubleshooting issue: {issue_id}")
    print(initial_prompt)
    
    sensemaker = sensemaking_process.SenseMaker(
        initial_prompt,
        presentation_instructions
    )
    sensemaker.make_sense()
    
    # Save the troubleshooting results to the CSV troubleshooting_steps field
    troubleshooting_steps = sensemaker.answer
    try:
        if troubleshooting_steps:
            # Update the issue with the troubleshooting steps
            update_issue(issue_id, {"troubleshooting_steps": troubleshooting_steps})
            print(f"Saved troubleshooting steps to CSV for issue {issue_id}")
    except Exception as save_error:
        print(f"Warning: Failed to save troubleshooting steps for issue {issue_id}: {save_error}")
    
    result = {
        "issue_id": issue_id,
        "troubleshooting_plan": troubleshooting_steps,
        "cached": False
    }
    return result


def troubleshooting_with_summary(summary):
    """
    Provides troubleshooting guidance based on just the issue summary.
    This function is useful when you don't have a specific issue ID but have the issue description.
    
    Args:
        summary (str): The issue summary/description to troubleshoot
        
    Returns:
        dict: Contains the troubleshooting plan for the given summary
    """
    if not summary or summary.strip() == "":
        return {"results": "No issue summary provided"}
    
    initial_prompt = f"""You need to troubleshoot the following issue: {summary}.

    Your task is to provide comprehensive troubleshooting guidance for this issue. Consider the following:
    
    1. Analyze the issue description and identify potential causes
    2. Gather information from relevant databases to understand the context
    3. Provide step-by-step troubleshooting recommendations
    4. Suggest potential root causes based on the issue description
    5. Recommend next steps for resolution
    
    Use the following databases to gather additional context:
    - Use "compliance database" to check user's recent compliance data
    - Use "past issues database" to find similar issues and their resolutions
    - Use "study docs database" to reference study procedures and protocols
    - If issue talks about specific data streams, use relevant databases like "location database", "activity database" etc.
    - Look at recent data to provide context and confirm if similar issues are present
    
    Start with your best guess on why the issue is happening based on the information available.
    Then provide a structured troubleshooting plan.
    Highlight the information used to come up with troubleshooting plan.
    """

    
    presentation_instructions = ''' Present a properly formatted and concise and effectuve troubleshooting plan.'''


    
    print(f"Troubleshooting issue summary: {summary}")
    print(initial_prompt)
    
    sensemaker = sensemaking_process.SenseMaker(
        initial_prompt,
        presentation_instructions
    )
    sensemaker.make_sense()
    
    result = {
        "issue_summary": summary,
        "troubleshooting_plan": sensemaker.answer,
    }
    return result

if __name__ == '__main__':
    # Test flag_issues function
    # criteria = "garmin worn < 25 hrs for 2 days"
    # date_str = "2025-08-25"
    # result = flag_issues(criteria, date_str)
    # print("Flag Issues Result:", result)
    
    # Test troubleshooting function
    criteria = "phone data duration < 20 hours for 2 days"
    date_str = "2025-09-20"
    flag_issues()
    print("\n" + "="*50)
    # print("Testing Troubleshooting Function:")
    # troubleshooting_result = troubleshooting("ISSUE_45")  # Replace with actual issue ID
    # print("Troubleshooting Result:", troubleshooting_result)
    
    # Test troubleshooting_with_summary function
    # print("\n" + "="*50)
    # print("Testing Troubleshooting with Summary Function:")
    # summary_result = troubleshooting_with_summary("Charger is broken so no data coming in")
    # print("Troubleshooting with Summary Result:", summary_result)