FROM ubuntu:18.04
# FROM mongo:4.0.6

# Set up Python versions -- we need very specific versions of Python
ENV PYTHON_VERSION 2.7.15
ENV PYTHON_MINOR_VERSION 2.7

# Stop prompts when using `docker build'
ENV DEBIAN_FRONTEND noninterative

# Set up time zone information
ENV TZ America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# General
RUN \
    pack_build="git \
                python$PYTHON_MINOR_VERSION \
                python$PYTHON_MINOR_VERSION-dev \
                wget \
                build-essential \
                cmake \
                calculix-ccx \
                gmsh \
                vim \
                curl \
                apt-utils \
                python-setuptools \
                python-pip " \
    && apt-get update \
    && apt-get install -y --no-install-recommends software-properties-common \
    && apt-get install -y --no-install-recommends $pack_build

# FreeCAD
RUN \
    add-apt-repository -y -u ppa:freecad-maintainers/freecad-stable \
    && apt-get install -y --no-install-recommends freecad freecad-doc

# Python PIP
RUN \
    pip install wheel \
    && pip install numpy spacy

# spaCy models
RUN \
    python -m spacy download en \
    && python -m spacy download en_vectors_web_lg

# GPG
RUN apt-get install -y gpg && apt-get install -y gpg-agent

# Node
RUN \ 
    curl -sL https://deb.nodesource.com/setup_11.x | bash - \
    && apt-get install -y nodejs

COPY . /sitdesign/

# Install NPM modules
RUN cd /sitdesign/site/ && npm install \
    && npm audit fix

# directory for storing user files -- required by application
RUN mkdir -p /sitdesign/site/files

# Start mongodb service
# RUN systemctl enable mongod.service
# RUN systemctl start mongod.service
# RUN mongod &

EXPOSE 3000
WORKDIR /sitdesign/site

# CMD ["mongod"]
CMD ["python", "/sitdesign/site/compute/main.py"]
CMD ["node", "/sitdesign/site/app.js"]
