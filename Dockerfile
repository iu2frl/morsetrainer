FROM node:latest
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
RUN apt update && apt install -y ebook2cw
COPY *.js ./
COPY *.json ./
COPY *.txt ./
CMD [ "node", "morsetrainer.js" ]
