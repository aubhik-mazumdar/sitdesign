FROM ubuntu:18.04

ENV PYTHON_VERSION 2.7.15
ENV PYTHON_MINOR_VERSION 2.7
ENV DEBIAN_FRONTEND noninteractive
ENV TZ America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# General
RUN \
	pack_build="git \
software-properties-common \
python$PYTHON_MINOR_VERSION \
python$PYTHON_MINOR_VERSION-dev \
gpg \
gpg-agent \
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
	&& apt-get install -y $pack_build

# FreeCAD
RUN \
	add-apt-repository -y -u ppa:freecad-maintainers/freecad-stable \
	&& apt-get install -y freecad

# Python PIP
RUN \
	pip install wheel \
	&& pip install numpy spacy

# spaCy models
RUN \
	python -m spacy download en \
	&& python -m spacy download en_vectors_web_lg

COPY . /compute/

WORKDIR /compute/

CMD ["python", "server.py"]
