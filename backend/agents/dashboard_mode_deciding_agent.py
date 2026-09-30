"""
This file contains the NextStepAgent class, which is responsible for determining the next step in a sensemaking process
based on user queries and understanding.
"""
import os
import sys

import langchain_openai as lcai
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder, PromptTemplate
from langchain_core.output_parsers import StrOutputParser

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import RunnablePassthrough
from pydantic import BaseModel, Field
from agents.llm_factory import get_llmchat

llmchat = get_llmchat()

class OutputMode(BaseModel):
    mode: str = Field(description="returned mode")

class ModeAgent:
    def __init__(self):
        self.mode_chain = self.mode_agent()

    def invoke_mode(self, input_params):
        """Invoke the next step agent to determine the next step in the sensemaking process"""
        mode_chain = self.mode_chain.invoke({
            'user_query': input_params['user_query']
        })

        return mode_chain

    def invoke(self, input_params):
        """Alias for invoke_mode for backward compatibility"""
        return self.invoke_mode(input_params)

    def mode_agent(self):
        """Create the next step agent chain"""
        prompt = """
            Your task is to determine the best mode based on user USER QUERY:

            USER QUERY:
            {user_query}

            Available modes are:
            
            
            1. Summary: If query has instructions to summarize the data or provide an overview.
            2. Analysis: If query has instructions to analyze the data, find correlations, trends, or patterns.
            3. Plotting: If query has instructions to create visualizations, charts, or graphs.
            4. Data Subsets: If query has instructions to filter, segment, or group the data. The query should explicitly mention that it needs data in csv format.
            5. Suggestions: If query has instructions to provide recommendations, insights, or suggestions based on the data. Use this mode when query asks a question from study documentation or asks for recommendations. 
            
            
            Do not use Data Subsets mode when query does not mention data is needed in CSV format specifically.   
            For generic questions choose Suggestions mode      
            Always choose one of the above modes that best fits the USER QUERY.
            if not sure return Analysis mode.
            
           

            return your response as a dict {{"mode": "<mode>"}} where <mode> is one of the above modes.
            
            Example: {{'mode': 'Summary'}}   
            Example: {{'mode': 'Analysis'}}
            Example: {{'mode': 'Plotting'}}
            Example: {{'mode': 'Data Subsets'}}
            Example: {{'mode': 'Suggestions'}}

            """

        parser = JsonOutputParser(pydantic_object=OutputMode)

        prompt = PromptTemplate(
            template=prompt + '\n {format_instructions}',
            input_variables=[],
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )

        chain = (prompt | llmchat | parser)

        return chain


if __name__ == "__main__":
    question = (
        "can you provide location sumamry of places where test004 was stationary based 07/09/2024 data")
    response = ModeAgent().invoke(
        {'user_query': question})
    print(response)
