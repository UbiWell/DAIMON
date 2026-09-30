

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
import sensemaking_process
from agents.dashboard_mode_deciding_agent import ModeAgent
from agents.config import GLOSS_ROOT
import random
import shutil
import json
import csv
from .nl_call_database import (
    create_call_record, update_call_response, get_mode_by_view_id, 
    get_response_by_view_id, get_call_statistics
)
def summary(query, view_id="default", is_redo=False, ra_name=""):
    """
    Generate a summary for the given query.
    
    Args:
        query: The user's search query
        view_id: The ID of the view making the request
        is_redo: Boolean flag indicating if this is a redo operation
        ra_name: The name of the RA (Research Assistant) making the call
        
    Returns:
        Dictionary containing summary results
    """
    if is_redo:
        # If redo is true, return response from database
        response = get_response_by_view_id(view_id)
        if response:
            return {
                "query": query,
                "results": response,
            }
        else:
            return {
                "query": query,
                "results": "No previous summary found for this view",
            }
    
    # If redo is false, generate new summary
    query = query + " Focus on summarizing what is asked."
    presentation_instructions_ = '''
        Summarize the following text in a detailed manner.
        Focus on summary
        Present answer as 
        summary: "your summary"
    '''
    sensemaker = sensemaking_process.SenseMaker(
        query,
        presentation_instructions_)
    sensemaker.make_sense()
    
    result = {
        "query": query,
        "results": sensemaker.answer,
    }
    
    # Update database with response
    update_call_response(view_id, sensemaker.answer)
    
    return result

def analysis(query, view_id="default", is_redo=False, ra_name=""):
    """
    Generate an analysis for the given query.
    
    Args:
        query: The user's search query
        view_id: The ID of the view making the request
        is_redo: Boolean flag indicating if this is a redo operation
        ra_name: The name of the RA (Research Assistant) making the call
        
    Returns:
        Dictionary containing analysis results
    """
    if is_redo:
        # If redo is true, return response from database
        response = get_response_by_view_id(view_id)
        if response:
            return {
                "query": query,
                "results": response,
            }
        else:
            return {
                "query": query,
                "results": "No previous analysis found for this view",
            }
    
    # If redo is false, generate new analysis
    query = query + " Focus on analyzing what is asked."
    presentation_instructions_ = '''
        Present a detailed analysis highlighting key insights and patterns.
    '''
    sensemaker = sensemaking_process.SenseMaker(
        query,
        presentation_instructions_)
    sensemaker.make_sense()
    
    result = {
        "query": query,
        "results": sensemaker.answer,
    }
    
    # Update database with response
    update_call_response(view_id, sensemaker.answer)
    
    return result

def suggestions(query, view_id="default", is_redo=False, ra_name=""):
    """
    Generate suggestions for the given query.
    
    Args:
        query: The user's search query
        view_id: The ID of the view making the request
        is_redo: Boolean flag indicating if this is a redo operation
        ra_name: The name of the RA (Research Assistant) making the call
        
    Returns:
        Dictionary containing suggestions results
    """
    if is_redo:
        # If redo is true, return response from database
        response = get_response_by_view_id(view_id)
        if response:
            return {
                "query": query,
                "results": response,
            }
        else:
            return {
                "query": query,
                "results": "No previous suggestions found for this view",
            }
    
    # If redo is false, generate new suggestions
    query = query + " Focus on suggesting what is asked. Use your literature and common sense to provide suggestions."
    presentation_instructions_ = '''
        Provide actionable suggestions based on the analysis.
    '''
    sensemaker = sensemaking_process.SenseMaker(
        query,
        presentation_instructions_)
    sensemaker.make_sense()
    
    result = {
        "query": query,
        "results": sensemaker.answer,
    }
    
    # Update database with response
    update_call_response(view_id, sensemaker.answer)
    
    return result


import os
import shutil


def _get_next_counter(counter_file):
    """Get the next counter value and update the counter file."""
    if os.path.exists(counter_file):
        with open(counter_file, "r") as f:
            try:
                current_number = int(f.read().strip())
            except ValueError:
                current_number = 0
    else:
        current_number = 0

    new_number = current_number + 1

    with open(counter_file, "w") as f:
        f.write(str(new_number))

    return new_number


def _run_sensemaker_until_files_exist(sensemaker_class, initial_instructions,
                                      presentation_instructions, full_code_path,
                                      full_output_path, max_iter=3):
    """Run sensemaker until required files are created."""
    for attempt in range(1, max_iter + 1):
        print(f"Attempt {attempt} of {max_iter} to run sensemaker.")
        sensemaker = sensemaker_class(initial_instructions, presentation_instructions)
        sensemaker.make_sense()

        if os.path.exists(full_code_path) and os.path.exists(full_output_path):
            return sensemaker

        print(f"Files not found after attempt {attempt}. Retrying...")
        print(f"Current path: {full_output_path}")

    raise FileNotFoundError(f"Failed to generate required files after {max_iter} attempts.")


def _process_file_generation(query, counter_file, code_prefix, output_extension,
                             instruction_template, response_template, sensemaker_class, output_prefix=None):
    """Common file generation processing for both graph and data_subsetting functions."""

    # Get next counter
    new_number = _get_next_counter(counter_file)

    # Setup file paths
    base_file_location = GLOSS_ROOT
    code_file = f"{code_prefix}_{new_number}.py"
    
    # Use output_prefix if provided, otherwise fall back to output_extension
    if output_prefix:
        output_file = f"{output_prefix}_{new_number}.{output_extension}"
    else:
        output_file = f"{output_extension}_{new_number}.{output_extension.split('_')[0]}"

    full_code_path = os.path.join(base_file_location, code_file)
    full_output_path = os.path.join(base_file_location, output_file)

    destination_folder = os.path.join(base_file_location, "dashboards_backend", "static", "images")
    os.makedirs(destination_folder, exist_ok=True)

    # Prepare instructions
    initial_instructions = instruction_template.format(
        query=query,
        code_file=code_file,
        output_file=output_file
    )

    # print(initial_instructions)
    # Check if files already exist
    if not (os.path.exists(full_code_path) and os.path.exists(full_output_path)):
        try:
            sensemaker = _run_sensemaker_until_files_exist(
                sensemaker_class, initial_instructions, response_template,
                full_code_path, full_output_path, max_iter=2
            )
        except FileNotFoundError as e:
            return {
                "status": "error",
                "message": str(e)
            }
    # Move files to destination
    new_code_path = os.path.join(destination_folder, code_file)
    new_output_path = os.path.join(destination_folder, output_file)

    if os.path.exists(full_code_path):
        shutil.move(full_code_path, new_code_path)

    if os.path.exists(full_output_path):
        shutil.move(full_output_path, new_output_path)

    # Return results with relative paths
    static_code_path = os.path.join('/static/images', code_file)
    static_output_path = os.path.join('/static/images', output_file)

    try:
        result = {
            "status": "success",
            "code_path": static_code_path,
        }

        # Add the appropriate output path key
        if output_extension in ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp']:
            result["image_path"] = static_output_path
        else:
            result["csv_path"] = static_output_path

        print("Result:", result)
        return result

    except Exception as e:
        print(f"Error in response: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


def graph(query, view_id="default", is_redo=False, ra_name=""):
    """
    Generate a plot for the given query.
    
    Args:
        query: The user's search query
        view_id: The ID of the view making the request
        is_redo: Boolean flag indicating if this is a redo operation
        ra_name: The name of the RA (Research Assistant) making the call
        
    Returns:
        Dictionary containing graph generation results
    """
    if is_redo:
        # If redo is true, return response from database
        response = get_response_by_view_id(view_id)
        if response:
            return response
        else:
            return {
                "status": "error",
                "message": "No previous graph found for this view"
            }
    
    # If redo is false, generate new graph
    print(query)

    instruction_template = (
        "Generate a plot for the following query: {query} "
        "save code as {code_file} and generated plot as {output_file} "
        "IMPORTANT: The plot file must have .png extension"
    )

    response_template = '''
        return a json dict
        example
        { 
        status: "success";
        code_file_name: "code_run_22.py",
        image_file_name: "image_plot_22.png",
        }
        IMPORTANT: The image_file_name must end with .png extension
        '''

    result = _process_file_generation(
        query=query,
        counter_file="image_counter.txt",
        code_prefix="code_run",
        output_extension="png",
        instruction_template=instruction_template,
        response_template=response_template,
        sensemaker_class=sensemaking_process.SenseMaker,
        output_prefix="image_plot"
    )
    
    # Update database with response
    update_call_response(view_id, result)
    
    return result


def data_subsetting(query, view_id="default", is_redo=False, ra_name=""):
    """
    Generate a CSV file for the given query.
    
    Args:
        query: The user's search query
        view_id: The ID of the view making the request
        is_redo: Boolean flag indicating if this is a redo operation
        ra_name: The name of the RA (Research Assistant) making the call
        
    Returns:
        Dictionary containing data subsetting results
    """
    if is_redo:
        # If redo is true, return response from database
        response = get_response_by_view_id(view_id)
        if response:
            return response
        else:
            return {
                "status": "error",
                "message": "No previous data subset found for this view"
            }
    
    # If redo is false, generate new data subset
    instruction_template = (
        "Generate a csv file for the following query: {query} "
        "save code as {code_file} and generated csv as as {output_file}"
    )

    response_template = '''
        return a json dict
        example
        { 
        status: "success";
        code_file_name: "code_csv_run_13.py",
        csv_file_name: "data_subset_13.csv",
        }
        '''

    result = _process_file_generation(
        query=query,
        counter_file="csv_counter.txt",
        code_prefix="code_csv_run",
        output_extension="csv",
        instruction_template=instruction_template,
        response_template=response_template,
        sensemaker_class=sensemaking_process.SenseMaker,
        output_prefix="data_subset"
    )
    
    # Update database with response
    update_call_response(view_id, result)
    
    return result

def detect_mode(query, view_id="default", refresh_interval="none", is_redo=False, ra_name=""):
    """
    Detect the mode of the given query and manage database records.
    
    Args:
        query: The user's search query
        view_id: The ID of the view making the request (default: "default")
        refresh_interval: The selected refresh interval (default: "none")
        is_redo: Boolean flag indicating if this is a redo operation (default: False)
        ra_name: The name of the RA (Research Assistant) making the call (default: "")
        
    Returns:
        Dictionary containing the detected mode
    """
    if is_redo:
        # If redo is true, return mode from database
        mode = get_mode_by_view_id(view_id)
        return {"mode": mode if mode else "unknown"}
    else:
        # If redo is false, detect mode and create database record
        mode_agent = ModeAgent()
        response = mode_agent.invoke({
            'user_query': query
        })
        
        # Extract mode from response
        mode = response.get('mode', 'unknown')
        
        # Create database record
        create_call_record(
            view_id=view_id,
            mode=mode,
            refresh_interval=refresh_interval,
            query=query,
            is_redo=False,
            ra_name=ra_name
        )
        
        return {"mode": mode}



if __name__ == "__main__":
    test_query = "Gimme me a csv having step count for last 7 days of test004 starting  7th september 2025"
    print(detect_mode(test_query))
