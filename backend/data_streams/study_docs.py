import sys
import os
import time

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data_processing')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../agents')))

# Function metadata/definitions for LLMs
functions = {
    "STUDY_DOCS_1": {
        "name": "get_relevant_information",
        "description": "Retrieves relevant information from study documents (consent forms, onboarding guides, etc.) based on a user query using RAG (Retrieval-Augmented Generation) technology.",
        "function_call_instructions": "Call this function when you need to find information from study documents, consent forms, onboarding materials, or any study-related documentation.",
        "code_generation_instructions": "Use this function to search through study documents and retrieve relevant information to answer questions about study procedures, participant information, consent details, or any study-related queries.",
        "usecase": ["code_generation", "function_calling"],
        "params": {
            "user_query": {"type": "str", "description": "The question or query to search for in the study documents."}
        },
        "returns": "A dictionary containing the answer to the user query based on the retrieved study documents, with source information included.",
        "example": "{'answer': 'The Principal Investigator (PI) for this study is Dr. Jane Smith, who can be contacted at jane.smith@university.edu. The study involves monitoring participant health data through wearable devices and mobile applications.'}"
    }
}

def get_relevant_information(user_query):
    """
    Retrieve relevant information from study documents based on a user query.
    
    Args:
        user_query (str): The question or query to search for in the study documents
        
    Returns:
        dict: A dictionary containing the answer based on retrieved study documents
    """
    try:
        # Import moved inside function to avoid circular import
        from agents.study_docs_rag_agent import RAGBasedTextDocsAgent
        
        # Initialize the RAG agent (will auto-detect study_docs directory)
        agent = RAGBasedTextDocsAgent()
        
        # Invoke the RAG agent with the user query
        result = agent.invoke_rag_agent({'question': user_query})
        
        # Return the result
        if hasattr(result, 'answer'):
            return {"answer": result.answer}
        elif isinstance(result, dict) and 'answer' in result:
            return result
        else:
            return {"answer": str(result)}
            
    except Exception as e:
        print(f"Error retrieving study document information: {e}")
        return {"answer": f"Failed to retrieve information: {str(e)}"}


if __name__ == "__main__":
    # Test the function
    test_query = "Who is the PI in this study?"
    result = get_relevant_information(test_query)
    print(f"Query: {test_query}")
    print(f"Result: {result}")
