import os

USE_AZURE = False
USE_GPT5 = False
ONLY_CODE_FUNCTIONS = True
VERBOSE = True
DOCKER_NAME = "gloss-sensemaking-code"
USE_CSV = True

# Absolute path to the GLOSS repo on the host. LLM-generated code runs here
# (mounted into the Docker container) and its outputs are written here.
# Defaults to this repo's folder; set the GLOSS_ROOT env variable to override.
GLOSS_ROOT = os.getenv("GLOSS_ROOT", os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
