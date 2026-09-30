import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import langchain_openai as lcai
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from pydantic import BaseModel, Field
from langchain import hub
from langchain_chroma import Chroma
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from agents.agent_utils import invoke_with_retry

# sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
#
# # embeddings = OpenAIEmbeddings(openai_api_key=os.environ["AZURE_OPENAI_API_KEY"])


from agents.rag_utils import get_data_to_narrative
from agents.llm_factory import get_llmchat
# Import moved inside function to avoid circular import
llmchat = get_llmchat()
class OutputPastIssues(BaseModel):
    past_issues: str = Field(description="list of relevant past issues ID")

def get_issues_to_narrative():
    """
    Convert issues from CSV to narrative format using the existing get_all_past_issue function.
    This function leverages the proper timestamp processing already implemented in past_issues.py.
    """
    try:
        # Use the existing function that properly handles CSV reading and timestamp conversion
        from data_streams.past_issues import get_all_past_issues
        issue_records = get_all_past_issues()
        
        if not issue_records:
            print("No issues found in CSV file.")
            return ""
        
        texts = []
        for row in issue_records:
            # Parse notes if it's a JSON string
            notes_text = ""
            if row.get('notes'):
                try:
                    import json
                    notes_dict = json.loads(row['notes'])
                    if notes_dict:
                        # Handle new format with timestamps
                        note_lines = []
                        for note_id, note_data in notes_dict.items():
                            if isinstance(note_data, dict):
                                # New format: {"content": "...", "username": "...", "timestamp": ...}
                                content = note_data.get('content', '')
                                username = note_data.get('username', 'Unknown')
                                timestamp = note_data.get('timestamp', '')
                                if timestamp:
                                    from datetime import datetime
                                    try:
                                        readable_time = datetime.fromtimestamp(int(timestamp)).strftime('%Y-%m-%d %H:%M:%S')
                                        note_lines.append(f"  - {username} ({readable_time}): {content}")
                                    except:
                                        note_lines.append(f"  - {username}: {content}")
                                else:
                                    note_lines.append(f"  - {username}: {content}")
                            else:
                                # Legacy format: just content
                                note_lines.append(f"  - {note_id}: {note_data}")
                        notes_text = "\n".join(note_lines)
                except:
                    notes_text = row['notes']
            
            text = (
                f"Issue ID: {row.get('id', 'N/A')}\n"
                f"Summary: {row.get('summary', 'N/A')}\n"
                f"User ID: {row.get('uid', 'N/A')}\n"
                f"Troubleshooting Steps: {row.get('troubleshooting_steps', 'N/A')}\n"
                f"Resolution: {row.get('resolution', 'N/A')}\n"
                f"Notes:\n{notes_text if notes_text else 'No notes'}\n"
                f"{'-' * 50}\n"
            )
            texts.append(text)
        
        return ''.join(texts)
        
    except Exception as e:
        print(f"Error reading issues from CSV: {e}")
        return ""

max_retries = 1

class RAGBasedPastIssuesAgent:
    def __init__(self):
        self.context = "blank"

    def invoke_rag_agent(self, input_params):

        self.context = get_issues_to_narrative()

        rag_chain = self.rag_agent()
        retries = 0
        while retries <= max_retries:
            try:
                info_chain = rag_chain.invoke(input_params['question'])
                return info_chain
            except Exception as e:
                retries += 1
                if retries > max_retries:
                    print(f"Failed after {max_retries + 1} attempts: {str(e)}")
                    return "FAILED"
        return info_chain

    def rag_agent(self):

        docs = Document(page_content=self.context)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents([docs])
        vectorstore = Chroma("past_issues")
        vectorstore._client.delete_collection("past_issues")
        vectorstore = Chroma.from_documents(collection_name="past_issues", documents=splits, embedding=OpenAIEmbeddings())
        retriever = vectorstore.as_retriever()
        # prompt = hub.pull("rlm/rag-prompt")
        prompt_text = """
        You are an assistant for retrieving relevant past issues (maximum upto three) to the given issue. 
    
        Use the following pieces of retrieved context to find relevant issues. Try your best to retrieve relevant past issues. If you can't do it, just return [].
        You can make estimations and intelligent guesses if the exact issues is not available.
        Issue: {question} 
        Context: {context} 
        
        
        You need to return relevant issues as a list of issues in json format.
        {{"past_issues": [ISSUE_1, ISSUE_4]}} 
        
        if not relevant, return empty list.
        {{"past_issues": []}}
        Just return the json, do not include any other text. do not include ```json or any other text.
        """
        prompt = PromptTemplate.from_template(prompt_text)

        def format_docs(docs):
            return "\n\n".join(doc.page_content for doc in docs)

        parser = JsonOutputParser(pydantic_object=OutputPastIssues)


        rag_chain = (
                {"context": retriever | format_docs, "question": RunnablePassthrough()}
                | prompt
                | llmchat
                | parser
        )
        return rag_chain




if __name__ == "__main__":
    question = "garmin has battery issues for test007 why?"
    a = RAGBasedPastIssuesAgent()
    response = a.invoke_rag_agent({'question': question})
    print("response----")
    print(response)