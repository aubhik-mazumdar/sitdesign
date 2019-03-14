FROM node:lts-jessie

WORKDIR /web/

RUN mkdir files

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "app.js"]
