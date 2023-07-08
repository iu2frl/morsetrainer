FROM node:20.3.1
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --loglevel verbose
RUN apt update && apt install -y ebook2cw
COPY *.js ./
COPY *.json ./
COPY *.txt ./
CMD [ "node", "morsetrainer.js" ]
