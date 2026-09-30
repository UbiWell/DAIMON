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
from dashboards_backend.issue_tracker.issue import Issue

llmchat = get_llmchat()


class OutputEmail(BaseModel):
    email: str = Field(description="email written by the agent")


def generate_email_prompt(user_id, ra_name, summary, past_notes, troubleshooting_steps):
    prompt = f""" You are an agent designed to draft email to users when there is data collection issues. 
    You are writing an email to users so refrain from using technical jargon that only research team need to know 
    and users do not need to know. Focus on what users can do to resolve the issue.
    
    Draft an email to users considering following factors \n"
    1) Summary of the data collection issues: 
    {summary}
    2) Past notes on data collection issues: 
    {past_notes}
    3) Troubleshooting steps:: 
    {troubleshooting_steps}
    
    start with Dear {user_id},
    end with 
    Best,
    {ra_name}
    Research Team
    
     5) Make sure to be empathetic and polite in the email.
     8) Sign off as Research Team
     9) Keep it brief
     10) Use RA notes to understand what emails is needed to be sent to user.
     """
    return prompt


class EmailAgent:
    def __init__(self):
        self.email_agent_chain = self.email_agent()

    def invoke_email_agent(self, input_params):
        """Invoke the next step agent to determine the next step in the sensemaking process"""
        summary = input_params['summary']
        user_id = input_params['user_id']
        ra_name = input_params['ra_name']
        past_notes = input_params['past_notes']
        troubleshooting_steps = input_params['troubleshooting_steps']

        prompt = generate_email_prompt(
            user_id, ra_name, summary, past_notes, troubleshooting_steps)

        email_agent_chain = self.email_agent_chain.invoke({
            'prompt': prompt
        })

        return email_agent_chain

    def invoke(self, input_params):
        """Alias for invoke_next_step for backward compatibility"""
        return self.invoke_email_agent(input_params)

    def email_agent(self):
        """Create the next step agent chain"""

        parser = JsonOutputParser(pydantic_object=OutputEmail)
        prompt = """{prompt}"""

        prompt = PromptTemplate(
            template=prompt + '\n {format_instructions}',
            input_variables=[],
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )

        chain = (prompt | llmchat | parser)

        return chain


if __name__ == "__main__":

    issue = create_dummy_issue()
    response = EmailAgent().invoke(
        {'issue': issue, 'additional instructions': ""})
    print(response)
