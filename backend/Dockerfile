# Use the official miniconda3 image as the base
FROM continuumio/miniconda3

# Set the working directory
WORKDIR /app

#ENV AZURE_OPENAI_API_KEY="add your key"
#ENV AZURE_OPENAI_API_ENDPOINT="add your endpoint"
#ENV MONGO_URI="mongodb://<username>:<password>@<host>:<port>/<database>?authSource=<database>"  # optional, only needed when USE_CSV = False
ENV OPENAI_API_KEY="add your key"
ENV RUNNING_IN_DOCKER=true

# Copy the environment file and install script to the Docker image
COPY environment.yml .
COPY install_packages.sh .


# Ensure the install script has execute permissions
RUN chmod +x install_packages.sh

# Run the install script using bash
RUN /bin/bash ./install_packages.sh

COPY stress-detection-algorithm-code-python /app/repo/stress-detection-algorithm-code-python

RUN /bin/bash -c "pip install -e ./repo/stress-detection-algorithm-code-python/"

# Activate the environment
SHELL ["conda", "run", "-n", "gloss-sensemaking", "/bin/bash", "-c"]

# Set the command to run when starting the container
CMD ["python"]
