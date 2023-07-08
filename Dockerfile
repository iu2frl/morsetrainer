FROM node:13
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
COPY *.js ./
COPY *.json ./
COPY *.txt ./
CMD [ "node", "morsetrainer.js" ]
