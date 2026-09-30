import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from langchain_core.prompts import PromptTemplate
from langchain_chroma import Chroma
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from pydantic import BaseModel, Field
from langchain_core.output_parsers import JsonOutputParser
from agents.llm_factory import get_llmchat

llmchat = get_llmchat()

# Define output schema for structured results
class OutputDocAnswer(BaseModel):
    answer: str = Field(description="Answer to the question based on the provided documents")

class RAGBasedTextDocsAgent:
    def __init__(self, docs_dir=None):
        self.docs_dir = self._get_study_docs_path() if docs_dir is None else docs_dir
        self.context = ""

    def _get_study_docs_path(self):
        """Get the study docs directory path, trying multiple possible locations."""
        # Try the standard location first (relative to this file)
        standard_path = os.path.join(os.path.dirname(__file__), '..', 'study_docs')
        standard_path = os.path.abspath(standard_path)
        print(f"Checking standard study docs path: {standard_path}")
        if os.path.exists(standard_path):
            print(f"Found study docs directory at standard path: {standard_path}")
            return standard_path
        
        # Try Docker workspace path
        docker_path = "/workspace/study_docs"
        print(f"Checking Docker study docs path: {docker_path}")
        if os.path.exists(docker_path):
            print(f"Found study docs directory at Docker path: {docker_path}")
            return docker_path
        
        # Try relative path from current working directory
        relative_path = os.path.join(os.getcwd(), "study_docs")
        print(f"Checking relative study docs path: {relative_path}")
        if os.path.exists(relative_path):
            print(f"Found study docs directory at relative path: {relative_path}")
            return relative_path
        
        # Fall back to standard path (will create directory if it doesn't exist)
        print(f"No existing study docs directory found, will use: {standard_path}")
        return standard_path

    def load_text_documents(self):
        """Load all .txt documents from self.docs_dir and return as a list of Document objects."""
        documents = []
        
        # Check if directory exists, create if it doesn't
        if not os.path.exists(self.docs_dir):
            print(f"Study docs directory does not exist: {self.docs_dir}")
            print(f"Creating directory: {self.docs_dir}")
            os.makedirs(self.docs_dir, exist_ok=True)
            return documents  # Return empty list if directory was just created
        
        try:
            for filename in os.listdir(self.docs_dir):
                if filename.endswith(".txt"):
                    file_path = os.path.join(self.docs_dir, filename)
                    with open(file_path, "r", encoding="utf-8") as f:
                        text = f.read()
                        documents.append(Document(page_content=text, metadata={"source": filename}))
        except Exception as e:
            print(f"Error loading documents from {self.docs_dir}: {e}")
            
        return documents

    def invoke_rag_agent(self, input_params):
        rag_chain = self.rag_agent()
        try:
            info_chain = rag_chain.invoke(input_params['question'])
            return info_chain
        except Exception as e:
            print(f"Error running RAG agent: {str(e)}")
            return {"answer": "FAILED"}

    def rag_agent(self):
        docs = self.load_text_documents()

        # Split into chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)

        # Reset / recreate vectorstore
        vectorstore = Chroma("text_docs")
        vectorstore._client.delete_collection("text_docs")
        vectorstore = Chroma.from_documents(
            collection_name="text_docs",
            documents=splits,
            embedding=OpenAIEmbeddings()
        )
        retriever = vectorstore.as_retriever()

        # Prompt
        prompt_text = """
        You are an assistant for answering questions based on a set of study documents 
        (consent forms, onboarding guides, etc.).

        Use the following pieces of retrieved context to answer the question. 
        Make intelligent inferences if the exact answer is not available.
        If you don't know, just say "I don’t know based on the provided documents."

        Question: {question} 
        Context: {context} 

        Provide a helpful answer based only on the context.
        {{"answer": "Answer here"}}
        Just return the json, do not include any other text. do not include ```json or any other text.
        """
        prompt = PromptTemplate.from_template(prompt_text)

        def format_docs(docs):
            # Print retrieved chunks for debugging
            # print("\n--- Retrieved Context ---")
            for d in docs:
                print(f"[Source: {d.metadata['source']}]\n{d.page_content}\n")
            # print("--- End Context ---\n")

            # Return the concatenated text for the prompt
            return "\n\n".join(f"Source: {d.metadata['source']}\n{d.page_content}" for d in docs)

        parser = JsonOutputParser(pydantic_object=OutputDocAnswer)

        rag_chain = (
            {"context": retriever | format_docs, "question": RunnablePassthrough()}
            | prompt
            | llmchat
            | parser
        )
        return rag_chain


if __name__ == "__main__":
    question = "Who is PI in this study?"
    agent = RAGBasedTextDocsAgent()  # Will auto-detect study_docs directory
    response = agent.invoke_rag_agent({'question': question})
    print("response----")
    print(response)
